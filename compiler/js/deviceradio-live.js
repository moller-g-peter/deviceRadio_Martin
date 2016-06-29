function DeviceRadioLive (host, vhost, username, password) {
	username = typeof username !== 'undefined' ? username : '';
	password = typeof password !== 'undefined' ? password : '';
	host = typeof host !== 'undefined' ? host : '';
	vhost = typeof vhost !== 'undefined' ? vhost : '';

	var that = this;

	this.connected = false; // global state
	this.queueing = false; // global queueing state

	var is_connected = false; // real state
	var is_yourturn = false; // true when your turn
	
	var retry = 0;
	
	// tokens
	var public_token = null;
	var private_token = null;
	
	// callbacks
	var cb_connected = null;
	var cb_disconnected = null;
	var cb_queue_changed = null;
	var cb_uploaded = null;
	var cb_uploaderr = null;
	var cb_yourturn = null;
	
	var ws = null;
	var client = null;
	
	var msg_fifo = [];
	
	// queue position
	queue_pos = null;
	queue_pend = false;
	
	/* private functions */
	
	// create uuid4
	var getUuid = function() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {var r = Math.random()*16|0,v=c=='x'?r:r&0x3|0x8;return v.toString(16);}); };
	
	// callback for incomming messages
	var on_rpc = function (frame) {
		var body = $.parseJSON( frame.body );
		if (('correlation-id' in frame.headers) && ((frame.headers['correlation-id'] === 'wipe') || (frame.headers['correlation-id'] === 'push'))) {
			if (body.error == "success") {
				if (cb_uploaded !== null) cb_uploaded();
			}
			else {
				if (cb_uploaderr !== null) cb_uploaderr(body.error);
			}
		}
		else if ('queue_length' in body && 'topUser' in body) {
			if (queue_pos !== null) {
				var new_pos = body.topUser.indexOf(public_token);
				if (queue_pos === 0 && new_pos !== 0) {
					queue_pos = null;
					that.queueing = false;
					if (cb_yourturn !== null) cb_yourturn(false);
				}
				else {
					if (new_pos === 0 && queue_pos !== 0 && cb_yourturn !== null) {
						that.queueing = true;
						cb_yourturn(true);
					}
					queue_pos = new_pos;
				}
			}
			if (cb_queue_changed !== null) cb_queue_changed(body.queue_length, queue_pos, body.topUser.length);
		}
	}
	
	// do a connection
	var do_connect = function _do_connect () {
		ws = new SockJS(host);
		client = Stomp.over(ws);
		client['onreceive'] = on_rpc;
		client.connect(username, password, function () {
			public_token = getUuid();
			private_token = getUuid();
			retry = 0;
			if (!that.connected) {
				that.connected = true;

				// signal that we are connected
				if (cb_connected !== null) cb_connected();
			}
				
			// subscribe to queue updates
			client.subscribe("/exchange/liveoffice/live_queue_update", on_rpc);
			
			// put us in queue
			if (queue_pend) {
				queue_pend = false;
				that.queue();
			}
						
			// send firmware on queue
			for (var i = 0; i < msg_fifo.length; i++) {
				that.upload(msg_fifo[i][0], msg_fifo[i][1]);
			}
			msg_fifo = [];
		}, function () {
			client.disconnect();
			if (queue_pos !== null) {
				queue_pend = true;
				queue_pos = null;
			}
			if (is_connected) {
				if (retry++ < 10) {
					var timeout = 10000;
					if (timeout <= 1) timeout = 500;
					if (timeout <= 4) timeout = 1000;
					else if (timeout <= 7) timeout = 5000;
					setTimeout(function () {
						_do_connect();
					}, timeout);
				}
				else that.diconnect();
			}
		}, vhost);
	}
	
	/* public functions */
	
	// connect to server
	this.connect = function () {
		if (!is_connected) {
			is_connected = true;
			do_connect();
		}
	}

	// disconnect from server
	this.disconnect = function () {
		if (is_connected) {
			is_connected = false;
			this.connected = false;
			queue_pos = null;
			queue_pend = false;
			client.disconnect();
			if (cb_disconnected !== null) cb_disconnected();
		}
	}

	// upload base64 encoded firmware to device
	this.upload = function (deviceId, bytecode) {
		bytecode = typeof bytecode !== 'undefined' ? bytecode : null;
		if (this.connected) {
			if (is_connected) {
				client.send('/exchange/worker/write.' + deviceId, {
					'reply-to': '/temp-queue/live',
					'correlation-id': (bytecode !== null) ? 'push' : 'wipe'
				}, JSON.stringify({
					"token": private_token,
					"firmware": bytecode
				}));
			}
			// queue the request if we are currently trying to reconnect
			else msg_fifo.push([deviceId, bytecode]);
		}
		else if (this.onUploadError !== null) this.onUploadError('not_connected');
	}
	
	// start queueing
	this.queue = function () {
		if (this.connected && queue_pos === null) {
			queue_pos = -1;
			this.queueing = true;

			// send our tokens
			client.send('/exchange/liveoffice/live_queue', {
				'reply-to': '/temp-queue/live',
				'correlation-id': 'ticket'
			}, JSON.stringify({
				"private_token": private_token,
				"public_token": public_token
			}));
		}
	}
	
	// register callbacks
	this.on = function (event, callback) {
		switch (event) {
		case 'connect':
			cb_connected = callback;
			break;
		case 'disconnect':
			cb_disconnected = callback;
			break;
		case 'queuechange':
			cb_queue_changed = callback;
			break;
		case 'yourturn':
			cb_yourturn = callback;
			break;
		case 'upload':
			cb_uploaded = callback;
			break;
		case 'uploaderror':
			cb_uploaderr = callback;
			break;
		}
	};
}
