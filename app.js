var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var multiparty = require('multiparty');
var fs = require('fs');
var fcheck = require('./fcheck');
var gm = require('gm');
var imageMagick = gm.subClass({ imageMagick: true });
var sizeOf = require('image-size');
var mime = require('mime');
var ffmpeg = require('fluent-ffmpeg');
var path = require('path');
var pinyin = require('pinyin');
var unames = {},
	usockets = {};
var uploadDir = "uploads/images/";
	
app.use(express.static('./'));

app.get('/',function(req,res){
	res.sendFile(__dirname+'/index.html');
});

if(!isFileExists(uploadDir)){
	mkdirp(uploadDir,'0o777',function(){});
}

function isFileExists(filePath){
	var bool = !0;
	try{
		fs.accessSync(filePath,fs.F_OK);
	}catch(err){
		bool = !1;
	}
	return bool;
}
function mkdirp(dirpath,mode,cb){
	var path = require('path');
	if(isFileExists(dirpath)){
		cb(dirpath);
	}else{
		mkdirp(path.dirname(dirpath),mode,function(){
			fs.mkdir(dirpath,mode,cb);
		});
	}
}

var stu = require('./student/student');
app.use('/student',stu);


app.get('/source',function(req,res){
	var fpath = req.query.path,
		fname = req.query.filename;
	if(isFileExists(fpath)){
		res.download(fpath,fname);
	}
});

app.post('/upload',function(req,res){
	// 解析一个文件上传
	var form = new multiparty.Form();
	var prefix = +new Date;
	//设置编辑
	form.encoding = 'utf-8';
	//设置文件存储路径
	form.uploadDir = uploadDir;
	//设置单文件大小限制 
	form.maxFilesSize = 100 * 1024 * 1024;
	//form.maxFields = 1000;  设置所以文件的大小总和
	form.parse(req, function(err, fields, files) {
		//同步重命名文件名
		var path = files.file[0].path;
		var targetPath = uploadDir+prefix+files.file[0].originalFilename,
			thumbPath =  uploadDir+'thumb_'+prefix+files.file[0].originalFilename,
			screenshotName = files.file[0].originalFilename.replace(/\..*/,'.png');
		var mimeType = mime.lookup(path);
		targetPath = targetPath.replace(" ","");
		fs.renameSync(path,targetPath);
		if(/^image.*/i.test(mimeType)){
			var dimensions = sizeOf(targetPath),
				w = 0;
				h = 0;
			if (dimensions.width >= dimensions.height) {
				w = 100;
				h = Math.floor(dimensions.height / (dimensions.width / 100));
			} else {
				h = 100;
				w = Math.floor(dimensions.width / (dimensions.height / 100));
			}
			imageMagick(targetPath)
			.resize(w,h) 
			.write(thumbPath, function(err) {
				if (err) {
					console.log(err);
					res.end();
				}
				res.json({code:1,data:'ok',src:targetPath,thumbSrc:thumbPath});
			});
		}else if(/^video.*/i.test(mimeType)){ 
			ffmpeg(targetPath).ffprobe(function(err, data) {
				console.log(data);
				var w = data.streams[0].width?data.streams[0].width:data.streams[1].width,
					h = data.streams[0].height?data.streams[0].height:data.streams[1].height,
					duration = data.format.duration,
					size = data.format.size,
					scaleW = 0,
					scaleY = 0;
				if (w > h) {
					scaleW = 200;
					scaleY = Math.floor(h / (w / 200));
				} else {
					scaleY = 200;
					scaleW = Math.floor(w / (h / 200));
				}
				ffmpeg(targetPath)
				.screenshots({
					timestamps: [0.5],
					filename: screenshotName,
					folder: './screenshots',
					size: scaleW+'x'+scaleY
				});
				res.json({code:2,data:'ok',w:scaleW,h:scaleY,src:targetPath,thumbSrc:'./screenshots/'+screenshotName});
			});
		}else if(/^audio.*/i.test(mimeType)){
			ffmpeg(targetPath).ffprobe(function(err, data) {
				var duration = data.format.duration,
					size = data.format.size;
				res.json({code:3,data:'ok',src:targetPath,size:size,duration:duration});
			});
		}else{
			res.json({code:4,data:'ok',src:targetPath});
		}
	});
});

io.on('connection',function(socket){
	var usrname = '',
		sendData = {};
	console.log('a client connect...'+socket.id);
	socket.on('disconnect',function(){
		if(usrname){
			console.log(usrname);
			delete unames[usrname];
			delete usockets[usrname];

			socket.broadcast.emit('user leave',{usrs:unames});
		}
	});

	socket.on('chat',function(data){
		var to = usockets[data.usrname],
			msgData = data,
			msg = data.msg;
		msgData.from = socket.id;
		to.emit('new message',msgData);
	});

	socket.on('add user',function(data){
		console.log(data,typeof data);
		var upinyin = pinyin(data.usrname,{style:pinyin.STYLE_NORMAL}).join("");
		usrname = data.usrname;
		unames[usrname] = {usrname:usrname,upy:upinyin,id:socket.id,ava:data.ava};
		usockets[usrname] = socket;
		sendData.usrs = unames;
		socket.emit('login',sendData);
		socket.broadcast.emit('user online',{usrs:unames});
	});
});

http.listen(3000,function(){
	console.log('start listening on 3000 port...');
});