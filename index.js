$(function(){
	var usrname = '',
		avatar = '',
		nick = '',
		ava = '',
		msgObj = {},
		isCNInp = !1,
		isChrome = !1,
		isCNFinish = !0,
		friendsObj = {},
		msgGapTime = 5*60*1000,
		socket = io()/*{on:function(){}}*/;
	var $chatWrap = $('.g-chat-wrap'),
		uploader = null;

	var maxScale = 4,
		increment = 0.1,
		currentScale = 1;

	var originDemension = {};

	

	var videoExtReg = /^\.(?=mpg|3gp|vob|rmvb|mov|flv|avi|wmv|mp4|mkv)/i,
		musicExtReg = /^\.(?=flac|ape|wav|mp3|aac|ogg|wma)/i,
		wordExtReg = /^\.(?=doc|docx)/i;

	isChrome = /(?=[^|\s])chrome\/\S+/i.test(navigator.userAgent);
		
	function rndAva(){
		var avatars = ['20160824083157.png','1.jpg','5.jpg','6.jpg','10.jpg'],
			len = avatars.length,
			idx = Math.floor(Math.random()*len);
		return avatars[idx];
	}

	function getObjectUrlFunc(){
		return window.createObjectURL||window.URL&&window.URL.createObjectURL||window.webkitURL && window.webkitURL.createObjectURL||void 0;
	}

	function isSupportMedia(){
		return !!document.createElement('audio').canPlayType;
	}

	function isSupportNotification(){
		return "Notification" in window;
	}

	var nfOK = !0;
	requestNotificationPermission();

	function requestNotificationPermission(){
		if(isSupportNotification()){
			if(Notification.permission === 'granted'){
				nfOK = !0;
			}else if(Notification.permission !== 'denied'){
				Notification.requestPermission(function(permission) {
					if (permission === "granted") {
						nfOK = !0;
					}else{
						nfOK = !1;
					}
				});
			}
		}else{
			nfOK = !1;
		}
	}

	function mediaAndFileFunc(file){
		var isSupportMediaPlay = !0,
			html = '',
			objUrlFunc = getObjectUrlFunc(),
			id = file.id,
			ext = '.'+file.ext,
			name = file.name,
			type = file.type,
			size = file.size>1024*1024?(file.size/(1024*1024)).toFixed(1)+'M':(file.size/(1024)).toFixed(1)+'KB';
			data = {type: 'file', avatar: avatar, isSelf: !0, id: id,size:size,name:name};
		isSupportMediaPlay = isSupportMedia() && objUrlFunc !== void 0;
		if(/^video\/.*/i.test(type)&&isSupportMediaPlay||videoExtReg.test(ext)){
			data.type = 'video';
		}else if(/^audio\/.*/i.test(type)&&isSupportMediaPlay||musicExtReg.test(ext)){
			data.type = 'audio';
		}else if(wordExtReg.test(ext)){
			data.type = 'word';
		}
		html = getMediaMsgHtml(data) ;
		return html;
	}

	function getMediaMsgHtml(data){ 
		var cls = data.isSelf?'self-message':'another-message',
			id = data.id || 0,
			html = '',
			content = '',
			ctnCls = '';
			switch(data.type){
			case 'audio':
				ctnCls = 'audio';
				break;
			case 'video':
				ctnCls = 'video';
				break;
			case 'word':
				ctnCls = 'word';
				break;
		}
		content = '<div class="msg-media clearfix">'+
				'	<i class="media-obj fl"></i>'+
				'	<div class="media-bd fl">'+
				'		<p class="file-name top">'+data.name+'</p>'+
				'		<p class="file-stats btm">'+
				'			<span class="file-size">'+data.size+'</span>'+
				'			<span class="sep">|</span>'+
				'			<span class="cancel-btn">取消</span>'+
				'		</p>'+
				'		<div class="progress">'+
				'			<div class="progress-bar"></div>'+
				'		</div>'+
				'	</div>'+
				'</div>';
		html = '<div class="message '+cls+'">'+
				'<div class="avatar">'+
				'<div class="radius"></div>'+
				'<img id="avatar" src="'+data.avatar+'" alt="头像">'+
				'</div>'+
				'<div class="message-cnt file-msg-cnt '+ctnCls+'" id="'+id+'">'+
				content+
				'</div>'+
				'</div>';
		return html;
		
	}

	function addQuene(file){
		var id = file.id,
			type = file.type,
			html = '',
			imgIdx = 0,
			chatId = $('.g-chat-wrap').attr('id'),
			timeHtml = '',
			imgList = $('.message-cnt').find('img');
		(imgList.length>0)&&(imgIdx = ~~imgList[imgList.length-1].getAttribute('img-idx')+1);
		timeHtml = ((msgObj[chatId]&&msgObj[chatId][msgObj[chatId].length-1]['lastMsgTime']<(+new Date()-msgGapTime))||!msgObj[chatId])?'<div class="message-time">=== '+getCurTime()+' ===</div>':'';
		uploader.makeThumb(file, function(error, ret) {
			if (error) {
				html =  timeHtml+mediaAndFileFunc(file);
			} else {
				html = timeHtml+getMsgHtml({type:2,msg: ret, avatar: avatar, isSelf: !0, id: id, idx: imgIdx }) 
			}
			$('#chatList').append(html);
		});
	}

	$('#emotion').SinaEmotion($('#messageTextarea'));
            

	function doSuccess(file,response){
		var id = file.id,
			idx = $('#picPicker').closest('.g-chat-wrap').attr('id'),
			msgData = {},
			code = response.code,
			$loading = $('#'+id).find('.loading');
		$loading.remove();
		msgData = {usrname:nick,msg:response.src,type:'img'};
		if(1 === code){
			$('#'+id).find('img').attr('origin-src',response.src);
			msgData.msg = response.src;
			msgData.type = 'img';
		}else if(2 === code){
			msgData.msg = response.src;
			msgData.type = 'video';
			msgData.thumbSrc = response.thumbSrc;
			msgData.w = response.w;
			msgData.h = response.h;
			
		}else if(3 === code){
			msgData.msg = response.src;
			msgData.type = 'audio';
			msgData.duration = response.duration;
		}else{
			msgData.msg = response.src;
			msgData.type = 'file';
			msgData.name = file.name;
			msgData.size = file.size;
		}
		socket.emit('chat',msgData);
		storeMessage(idx,$.extend(msgData,{isSelf:!0,lastMsgTime:+new Date()}));
		$('#'+id).find('.cancel-btn').text('已发送').removeClass('cancel-btn').end().find('.progress').remove();
	}

	var BASE_URL = '.';
	uploader = WebUploader.create({
		auto: !0,
		dnd:'#chatList',
		disableGlobalDnd:!0,
		swf: BASE_URL + '/Uploader.swf',
		server: '/upload',
		threads:1,
		fileVal:'file',
		thumb:{
			allowMagnify:!1
		},
		pick: {
			id: '#picPicker',
			multiple: !1
		}/*,
		accept: {
			title: 'Images',
			extensions: 'gif,jpg,jpeg,bmp,png',
			mimeTypes: 'image/*,audio/*,video/*'
		}*/
	});
	uploader.on('beforeFileQueued', function(file) {
	/*	var src=window.createObjectURL&&window.createObjectURL(file.source.source)||window.URL&&window.URL.createObjectURL(file.source.source)||window.webkitURL && window.webkitURL.createObjectURL(file.source.source);
		return console.log(src),!1;*/
	});
	uploader.on('fileQueued', function(file) {
		addQuene(file);
	});
	uploader.on('uploadProgress', function(file, percentage) {
		var id = file.id,
			$queneItem = $('#'+id),
			width = 0,
			$progress = $queneItem.find('.progress-bar');
		if($progress.length>0){
			width = $queneItem.find('.progress').width();
			$progress.width(width*percentage);
		}
		
	});
	uploader.on('uploadSuccess', function(file, response) {
		doSuccess(file, response);
	});
	uploader.on('uploadError', function(file, response) {
		alert("上传文件出错，请重试！");
	});
	uploader.on('uploadFinished', function(file) {
		uploader.reset();
	});
	uploader.on('error', function(errorType) {
		switch (errorType) {
			case "Q_TYPE_DENIED":
				alert("请上传图片！");
				break;
		}
		return false;
	});


	$('#smbt').on('click',function(e){
		var val = $('#nick').val();
		if (val === '') {
			return alert('昵称不能为空'), !1;
		}
		usrname = val;
		avatar = rndAva();
		socket.emit('add user', {
			usrname: usrname,
			ava: avatar
		});

	});

	$('body').on('click','#imgLayer',function(e){
		$(this).hide();
	});


	$('#searchInp').on("keyup",function(e){
		var val = $.trim($(this).val());
		if( (isCNInp&&((!/^[1-9]{1}$/.test(String.fromCharCode(e.keyCode))&&(!/^(32|16|13)$/.test(e.keyCode.toString())))))/* || val===""*/) return /*$searchResultWrap.hide(),$friendList.show(),*/!0;
		showSearchResult(val);

	}).on('keydown',function(e){
		if(e.keyCode === 229 ){
			isCNInp = !0;
		}else{
			isCNInp = !1;
		}
	}).on('compositionend',function(e){
		var val = '';
		if(isChrome){
			val = $.trim($(this).val()).slice(0,-1);

			showSearchResult(val);
		}
	});

	function showSearchResult(val){
		var	uname = '',
			py = '',
			html = '',
			$searchResultWrap = $('#searchList'),
			$friendList = $('#friendList'),
			idx = 0;
		if( val==="") return $searchResultWrap.hide(),$friendList.show(),!0;
		
		$friendList.hide();
		$searchResultWrap.find('ul').empty();
		for (var i in friendsObj) {
			if(i !== usrname){
				uname = friendsObj[i].usrname;
				py = friendsObj[i].upy;
				if((uname+py).indexOf(val)>-1){
					html+=getSearchItemHtml(friendsObj[i]);
				}
			}
		}
		$searchResultWrap.find('ul').html(html).end().show();

	}

	function storeMessage(id,dataObj){
		msgObj[id] = msgObj[id]? (msgObj[id].push(dataObj),msgObj[id]):[dataObj];
	}

	function handleMouseWheel(e) {
		var delta = getWheelDelta(e),
			scale = 0,
			increW = 0,
			increH = 0;
		if (delta > 0) {
			scale = currentScale + increment;
		} else {
			scale = currentScale - increment;
		}
		scale = scale > maxScale ? maxScale : 1 / maxScale > scale ? 1 / maxScale : scale;
		currentScale = scale;
		increW = Math.round(originDemension.w*scale);
		increH = Math.round(originDemension.h*scale);
		$(this).parent().css({
			"width": increW,
			"height": increH,
			"margin-left": -increW / 2,
			"margin-top": -increH / 2
		});
	}

	function getWheelDelta(e) {
		var delta = 0;
		if (e.wheelDelta) {
			delta = e.wheelDelta;
		} else {
			delta = -e.detail * 40;
		}
		return delta;
	}

	function stopBubble(e){
		console.log(1111);
		if (e.stopPropagation) {
			e.stopPropagation();
		} else {
			e.cancelBubble = true;
		}
	}

	function addEvent(elem, type, fn) {
		if (elem.addEventListener) {
			elem.addEventListener(type, fn, !1)
		} else if (elem.attachEvent) {

			elem.attachEvent('on' + type, function(e) {
				e = e || window.event;
				fn.call(elem, e);
			});
		} else {
			elem['on' + type] = function(e) {
				fn.call(elem, e || window.event);
			};
		}

	}

	function change(img,idx,imgList,$imgLayer,$loading){
		var imgSrc = imgList[idx].src,
			bigImgSrc = imgList[idx].originSrc;
		switchImg(img,imgSrc,$imgLayer,$loading,!1);
		switchImg(img,bigImgSrc,$imgLayer,$loading,!0);
	}

	function switchImg(img,src,container,$loading,isShow){
		var imgObj = new Image();
		imgObj.src = src;
		if (imgObj.complete) {
			img.src = src;
			w = imgObj.width;
			h = imgObj.height;
			(!isShow)&&($loading.show());
			isShow&&($loading.hide(),originDemension.w = w,originDemension.h = h);
			container.find('.u-img-container').css({
				"width":w,
				"height":h,
				"margin-left": -w / 2,
				"margin-top": -h / 2
			}).show().end().show();
		}else{
			imgObj.onload = function() {
				img.src = src;
				w = imgObj.width;
				h = imgObj.height;
				(!isShow)&&($loading.show());
				isShow&&($loading.hide(),originDemension.w = w,originDemension.h = h);
				container.find('.u-img-container').css({
					"width": w,
					"height": h,
					"margin-left": -w / 2,
					"margin-top": -h / 2
				}).show().end().show();
			};
		}
		
	}	
	$('#chatList').on('click','.message-cnt img',function(e){
		e.stopPropagation();
		var $imgLayer = $('#imgLayer'),
			$loading = null,
			html = '',
			imgSrc = $(this).attr('src'),
			targetImgSrc = $(this).attr('origin-src'),
			imgObj = new Image(),
			image = new Image(),
			img = null,
			idx = $(this).attr('img-idx'),
			w = 0,
			h = 0,
			curIdx = 0,
			$prev = null,
			$next = null,
			imageList = [];
		/*image.src = imgSrc;
		imgObj.src = targetImgSrc;*/
		if($imgLayer.length==0){
			html =  '<div class="g-img-layer" id="imgLayer">'+
					'	<div class="u-img-container">'+
					'		<img src="" alt="图片预览">'+
					' 		<div class="loading"></div>'+
					'	</div>'+
					'	<div class="u-tools-container">'+
					' 		<a href="javascript:;" class="btn prev"><i class="icon"></i></a>'+
					' 		<a href="javascript:;" class="btn next"><i class="icon"></i></a>'+
					' 	</div>'+
					'</div>';
			$('body').append(html);
			$imgLayer = $('#imgLayer');
		}else{
			$imgLayer.find('.loading').show();
			$imgLayer.find('img').attr('src',imgSrc);
		}
		img = $imgLayer.find('img')[0];
		$prev = $imgLayer.find('.btn.prev');
		$next = $imgLayer.find('.btn.next');
		$loading = $imgLayer.find('.loading');
		$imgs = $('.message-cnt').find('img');
		for(var i = 0,len=$imgs.length;i<len;i++){
			imageList.push({src:$imgs[i].src,originSrc:$imgs[i].getAttribute('origin-src')});
		}
		(idx == 0) && ($prev.addClass('disabled'));
		(idx == imageList.length-1) && ($next.addClass('disabled'));
		
		addEvent(img,'click',stopBubble);
		addEvent(img,'mousewheel',handleMouseWheel);
		addEvent(img,'DOMMouseScroll',handleMouseWheel);


		$prev.on('click',function(e){
			e.preventDefault();
			e.stopPropagation();
			if ($(this).hasClass('disabled')) return;
			curIdx--;
			(curIdx < 0) && (curIdx = 0);
			(curIdx == 0) && ($(this).addClass('disabled'));
			$next.removeClass('disabled')
			change(img,curIdx,imageList,$imgLayer,$loading);
		});

		$next.on('click',function(e){
			e.preventDefault();
			e.stopPropagation();
			if($(this).hasClass('disabled')) return;
			curIdx++;
			(curIdx > len-1 ) && (curIdx = len-1);
			(curIdx == len-1) && ($(this).addClass('disabled'));
			$prev.removeClass('disabled')
			change(img,curIdx,imageList,$imgLayer,$loading);
		});

		switchImg(img,imgSrc,$imgLayer,$loading,!1);
		switchImg(img,targetImgSrc,$imgLayer,$loading,!0);

	}).on('click','.voice-player',function(e){
		var src = $(this).attr('voice-src'),
			suffix = src.slice(-3),
			$that = $(this);
		if($that.hasClass('playing')) return;
		var $playElem = $('.voice-player.playing');
		$playElem.find('.duration').text($playElem.attr('duration'));
		$that.closest('.message').siblings('.message').find('.voice-player').removeClass('active playing');
		$that.addClass('active').attr('duration',$that.find('.duration').text()).find('.unread-red-dot').remove();
		if($('#audioPlayerWrap').length<=0){
			$('<div class="aduio-player-wrap" id="audioPlayerWrap"></div>').appendTo('.g-im');
			$("#audioPlayerWrap").jPlayer({
				ready: function() {
					$(this).jPlayer("setMedia", {
						mp3: src
					});
				},
				swfPath: "jplayer",
				supplied: "mp3, m4a, oga",
				canplaythrough: function() {
					$('.voice-player.active').removeClass('active').addClass('playing');
					$(this).jPlayer('play');
				},
				timeupdate:function(event){
					var str = formatDuration(~~event.jPlayer.status.duration-~~event.jPlayer.status.currentTime);
					$('.voice-player.playing').find('.duration').text(str);
				},
				ended:function(event){
					$('.voice-player.playing').removeClass('playing').find('.duration').text(formatDuration(~~event.jPlayer.status.duration));
				}
			});
		}else{
			$("#audioPlayerWrap").jPlayer("setMedia",{
				mp3: src
			});
		} 
	}).on('click','.player-btn',function(e){
		/*var src = $(this).attr('video-src');
		$(this).closest('.message-cnt')
		.jPlayer({
			ready: function() {
				$(this).jPlayer("setMedia", {
					m4v: src
				}).jPlayer('play');
			},
			swfPath: "jplayer",
			supplied: "m4v,webmv,ogv",

		});*/
	});

	$('#userList').on('click','li',function(e){
		console.log(msgObj);
		var html = '',
			timeHtml = '',
			msgType = '',
			message = null,
			videoIdxArr = [],
			idx = 0;
		if($(this).hasClass('opened')) return;
		var id = $(this).attr('idx');
		nick = $(this).find('.u-nickname span').text();
		ava = $(this).find('#avatar').attr('src');
		$chatWrap.attr('id',id);
		$(this).addClass('opened').find('.new-message').text("").end().siblings('li').removeClass('opened');
		timeHtml = '<div class="message-time">=== '+getCurTime()+' ===</div>';
		
		if(msgObj[id] !== void 0){
			for(var i=0,l=msgObj[id].length;i<l;i++){
				message = msgObj[id][i];
				msgType = message['type'];
				console.log(msgType);
				if(msgType==='txt'){
					html+=getMsgHtml({type:1,msg:AnalyticEmotion(message['msg']),avatar:ava,isSelf:message['isSelf'],isShow:!1});
				}else if(msgType==='img'){
					html+=getMsgHtml({type:2,msg:message['msg'],avatar:ava,isSelf:message['isSelf'],isShow:!1,idx:idx++});
				}else if(msgType==='audio'){
					html+=getMsgHtml({type:4,msg:message['msg'],avatar:ava,isSelf:message['isSelf'],isShow:!1,duration:message['duration']});
				}else if(msgType==='video'){
					videoIdxArr.push(i);
					html+=getMsgHtml({type:3,msg:message['msg'],ss:message['thumbSrc'],avatar:ava,isSelf:message['isSelf'],isShow:!1});
				}else{
					html+=getMsgHtml({type:5,msg:message['msg'],name:message['name'],size:message['size'],avatar:ava,isSelf:message['isSelf'],isShow:!1});
				}	
			}
			$('#chatList').html(timeHtml+html);
			$('.jp-video').each(function(idx, el) {
				initVideoPlayer(msgObj[id][videoIdxArr[idx]]);
			});
		}else{
			$('#chatList').html("");
		}
		/*if($chatWrap.is(':visible')){
			$chatWrap.find('#chatNick').text(nick);
		}else{
			$chatWrap.find('#chatNick').text(nick).end().show();
		}*/
		$chatWrap.find('#chatNick').text(nick).end().find('#an-avatar').attr('src',ava).end().show();
	});

	$('.g-chat-wrap').on('click','.close-icon',function(e){
		var $wrap = $(this).closest('.g-chat-wrap'),
			id = $wrap.attr('id');
		$wrap.hide();
		$('#userList').find('[idx="'+id+'"]').removeClass('opened');
	});

	$('.m-foot').on('click','#sendBtn',function(e){
		var val = $('#messageTextarea').val(),
			id = $(this).closest('.g-chat-wrap').attr('id'),
			html = ((msgObj[id]&&msgObj[id][msgObj[id].length-1]['lastMsgTime']<(+new Date()-msgGapTime))||!msgObj[id])?'<div class="message-time">=== '+getCurTime()+' ===</div>':'';
		$('#chatList').append(html+getMsgHtml({type:1,msg:AnalyticEmotion(val),avatar:avatar,isSelf:!0,isShow:!1}));
		socket.emit('chat',{usrname:nick,msg:val,type:'txt'});
		storeMessage(id,{msg:val,type:'txt',isSelf:!0,lastMsgTime:+new Date()});
		$('#messageTextarea').val('');
	});

	function formatDuration(time){
		var duration = time,
			str = (Math.floor(duration / 60) > 0 ? Math.floor(duration / 60) + '′' : '') + (duration % 60 > 0 ? duration % 60 + '″' : '');
		return str;
	}

	function getMsgHtml(data){
		var cls = data.isSelf?'self-message':'another-message',
			id = data.id || 0,
			thumb = '',
			content = '',
			isShow = data.isShow === void 0? !0:data.isShow;

		switch(data.type){
			case 1:
				content = '<span>'+data.msg+'</span>';
				break;
			case 2:
				if((!/^data:image\/jpeg.*/.test(data.msg))) thumb = data.msg.replace(/([^\/]+\..+)/,"thumb_$1");
				else thumb = data.msg;
				cls+=' img-msg';
				content = '<img src="'+thumb+'" origin-src="'+data.msg+'" img-idx="'+data.idx+'" alt="图片消息">';
				break;
			case 3:
				var videoId = 'video_'+data.msg.match(/[^\/]+\.{1}/)[0].slice(0,-1);
				cls+=' video-msg';
				/*content = '<img src="'+data.ss+'"  alt="视频消息"><div class="overlay"><i class="player-btn" video-src="'+data.msg+'"></i></div>';*/
				content = '<div id="'+videoId+'_wrap'+'" class="jp-video"><div id="'+videoId+'" class="jp-jplayer"></div>'+'<div class="jp-video-play-1"><span class="jp-video-play-icon" role="button"></span></div></div>';
				break;
			case 4:
				var duration = ~~data.duration,
					str = (Math.floor(duration/60)>0?Math.floor(duration/60)+'′':'')+(duration%60>0?duration%60+'″':'');
				var w = duration>147?147:duration<80?80:duration;
				cls+=' audio-msg';
				content = '<a href="javascript:;" class="voice-player" voice-src="'+data.msg+'" style="width:'+w+'px;"><span class="empty fl"></span><div class="player-wrap"><span class="voice-icon"></span><span class="duration">'+str+'</span></div><span class="empty rt"></span><span class="unread-red-dot"></span></a>'
				break;
			default:
				var size = data.size>1024*1024?(data.size/(1024*1024)).toFixed(1)+'M':(data.size/(1024)).toFixed(1)+'KB';
				cls+=' file-msg';
				content = '<div class="msg-media clearfix">'+
				'	<i class="media-obj fl"></i>'+
				'	<div class="media-bd fl">'+
				'		<p class="file-name top">'+data.name+'</p>'+
				'		<p class="file-stats btm">'+
				'			<span class="file-size">'+size+'</span>'+
				'			<span class="sep">|</span>'+
				'			<a class="download-btn" href="/source?filename='+data.name+'&path='+data.msg+'">下载</a>'+
				'		</p>'+
				'	</div>'+
				'</div>';
				break;
		}
		if(isShow) content+='<div class="loading"></div>';
		var html = '<div class="message '+cls+'">'+
				'<div class="avatar">'+
				'<div class="radius"></div>'+
				'<img id="avatar" src="'+data.avatar+'" alt="头像">'+
				'</div>'+
				'<div class="message-cnt" id="'+id+'">'+
				content+
				'</div>'+
				'</div>';
		return html;
	}

	function getCurTime(){
		var date = new Date,
			hour = date.getHours(),
			minutes = date.getMinutes();
		(hour<10)&&(hour = '0'+hour);
		(minutes<10)&&(minutes = '0'+minutes);
		return hour+':'+minutes;
	}

	socket.on('connect',function(){
		console.log('正在连接中...');
	});

	socket.on('login',function(data){
		friendsObj = data.usrs;
		$('.g-login').remove();
		$('.g-im').find('#nickname').text(usrname).end().find('#avatar').attr('src',avatar).end().show();
		$('.g-im').find('#userList').html(getFriendHtml(data.usrs));
	});

	socket.on('user leave',function(data){
		friendsObj = data.usrs;
		$('.g-im').find('#userList').html(getFriendHtml(data.usrs));
	});

	socket.on('user online',function(data){
		friendsObj = data.usrs;
		$('.g-im').find('#userList').html(getFriendHtml(data.usrs));
	});

	var initBgW = -1;

	/*function changeBg(){
		var position = initBgW+'px '+"-171px";
		initBgW-=20;
		(initBgW<-220)&&(initBgW=-1);
		$('.voice-icon').css('background-position',position);
		setTimeout(function(){
			changeBg();
		},50);
	}*/

	socket.on('new message',function(data){
		var id = data.from.slice(2),
			imgList = null,
			imgIdx = 0,
			html = '',
			nval = '',
			obj = {},
			msg = data.msg;
		obj = {type:1,msg:msg,avatar:ava,self:!1,isShow:!1};
		if(data.type=='txt'){
			nval = msg;
			obj.msg = AnalyticEmotion(msg);
		}else if(data.type=='img'){
			nval = "给你发了一张图片";
			obj.type = 2;
			obj.idx = imgIdx;
		}else if(data.type=='video'){
			nval = "给你发了一个视频";
			obj.type = 3;
			obj.ss = data.thumbSrc;
		}else if(data.type=='audio'){
			nval = "给你发了一个语音";
			obj.type = 4;
			obj.duration = data.duration;
		}else{
			nval = "给你发了一个文件";
			obj.type = 5;
		}
		if($('#'+id).length>0){
			imgList = $('.message-cnt').find('img');
			html = ((msgObj[id]&&msgObj[id][msgObj[id].length-1]['lastMsgTime']<(+new Date()-msgGapTime))||!msgObj[id])?'<div class="message-time">=== '+getCurTime()+' ===</div>':'';
			(imgList.length>0)&&(imgIdx = ~~imgList[imgList.length-1].getAttribute('img-idx')+1);
			$('#chatList').append(html+getMsgHtml(obj));
			if(data.type=='video'){
				initVideoPlayer(data);
			}
			//changeBg();
		}else{
			var msgNum = ~~$('#userList').find('[idx="'+id+'"]').find('.new-message').text();
			msgNum++;
			$('#userList').find('[idx="'+id+'"]').find('.new-message').text(msgNum);
		}
		if(nfOK){
			pushMsgNotification($('#userList').find('[idx="'+id+'"]').find('.u-nickname').find('span').text(),nval,$('#userList').find('[idx="'+id+'"]').find('img').attr('src'));
		}
		msgObj[id] = msgObj[id]? (msgObj[id].push($.extend(data,{isSelf:!1,lastMsgTime:+new Date()})),msgObj[id]):[$.extend(data,{isSelf:!1,lastMsgTime:+new Date()})];
	});

	function pushMsgNotification(from,val,ava){
		var options = {
			body: val,
      		icon: ava
		};
		var n = new Notification("来自 "+from+" 的消息" ,options);
		n.onshow = function(){
			setTimeout(function(){
				n.close();
			},1500);
		};
	}

	function initVideoPlayer(data){
		var id = 'video_'+data.msg.match(/[^\/]+\.{1}/)[0].slice(0,-1);
			$video = $('#'+id);
		$video
			.jPlayer({
				ready: function() {
					var $that = $(this);
					$that.jPlayer("setMedia", {
						m4v: data.msg,
						poster: data.thumbSrc,
					});

					$that.parent().find('.jp-video-play-icon').on('click', function(e) {
						$('.jp-state-playing').jPlayer('pause').jPlayer('stop').find('img').show().end().find('[id*=jp_video]').hide().end().find('.jp-video-play-1').show();
						$that.parent().find('.jp-video-play-1').hide();
						$that.parent().find('img').hide();
						$that.parent().find('[id*=jp_video]').show();
						$that.jPlayer('play');
					});
				},
				swfPath: "jplayer",
				supplied: "m4v,webmv,ogv",
				cssSelectorAncestor: '#'+id+'_wrap',
				size:{
					width:data.w+'px',
					height:data.h+'px'
				},
				ended:function(event){
					$(this).parent().find('.jp-video-play-1').show();
					$(this).parent().find('img').show();
					$(this).parent().find('[id*=jp_video]').hide();
				}
			});
		$video.find('[id*=jp_video]').on("click",function(e){
			var src = data.msg,
				poster = data.thumbSrc;
			if($video.parent().hasClass('jp-state-playing')){
				$video.jPlayer('pause').jPlayer('stop').find('img').show().end().find('[id*=jp_video]').hide().end().next().show();
				if($('#jquery_jplayer_1').length>0){
					$('#jquery_jplayer_1').jPlayer('setMedia',{
						m4v: src,
						poster: poster,
					}).jPlayer('play');
					$('#jp_container_1').fadeIn();
				}else{
					$('<div id="jp_container_1"><div id="jquery_jplayer_1"></div></div>').appendTo('body');
					$("#jquery_jplayer_1").jPlayer({
						ready: function() {
							$(this).jPlayer("setMedia", {
								m4v: src,
								poster: poster,
							}).jPlayer('play');
						},
						swfPath: "jplayer",
						supplied: "m4v,webmv,ogv",
						cssSelectorAncestor: '#jp_container_1',
						loop:!0,
						size: {
							width: '640px',
							height: '360px'
						}
					});
					$('#jp_container_1').off('click').on('click',function(e){
						$("#jquery_jplayer_1").jPlayer('pause').jPlayer('stop');
						$(this).fadeOut();
					});
				}
			}
		});
	}

	function getSearchItemHtml(usr){
		var html = '',
			avatar = '';
	
		avatar = usr.ava;
		upinyin = usr.upy;
		html += '<li class="u-item person" idx="'+usr.id.slice(2)+'">'+
		'<div class="u-avatar">'+
		'<div class="radius"></div>'+
		'<img id="avatar" src="'+avatar+'" alt="头像">'+
		'</div>'+
		'<div class="u-nickname" data-upy="'+upinyin+'">'+
		'<span>'+usr.usrname+'</span>'+
		'</div>'+
		'</li>';
		
		return html;
	}

	function getFriendHtml(users){
		var html = '',
			avatar = '';
		for(var i in users){
			if(i !== usrname){
				avatar = users[i].ava;
				upinyin = users[i].upy;
				html += '<li class="u-item person" idx="'+users[i].id.slice(2)+'">'+
				'<div class="u-avatar">'+
				'<div class="radius"></div>'+
				'<span class="new-message red-circle"></span>'+
				'<img id="avatar" src="'+avatar+'" alt="头像">'+
				'</div>'+
				'<div class="u-nickname" data-upy="'+upinyin+'">'+
				'<span>'+i+'</span>'+
				'</div>'+
				'</li>';
			}
		}
		return html;
	}

});