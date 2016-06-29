DeviceRadio.Compiler.prototype.objects['uart'] = {
	// initiate
	setup: function() {		
		// define the uart symbol
		this.that._s['uart'] = {
			base: 'uart',
		};
	},
	
	// template
	template: {
		props: ['baud'],
		require: []
	},
	
	// validate configuration properties
	validate: function(symbol) {
		var that = this.that;
		var entry = that._s[symbol];
		// iterate properties
		for (var prop in entry.conf) {
			if (entry.conf.hasOwnProperty(prop)) {
				var val = entry.conf[prop];
				switch (prop) {
				case 'baud':
					that.assert(val, "INTEGER", {
						min: 1200,
						max: 256000
					});
					break;
				default:
					throw new DeviceRadio.Compiler.CompilerException("Unknown property '" + prop + "'", val);
					break;
				}
			}
		}
	}
};