DeviceRadio.Compiler.prototype.objects['trigger'] = {
	// template
	template: {
		calls: {
			'': {
				arg: [0],
				mod: []
			}
		}
	},

	// analyze call
	analyze: function(sub, call, regs, args) {
		var that = this.that;
		
		// validate and log usage
		if (args[0].type === "TRIGGER") {
			that._t[args[0].name].source.push(sub);
			that._t[args[0].name]['conditional'] = false;
		}
		else if (args[0].type === "SYMBOL") {
			if (args[0].invert)
				throw new DeviceRadio.Compiler.CompilerException("Unexpected '!'", args[0]);
			if (!('trigger' in that._s[args[0].name]) || that._s[args[0].name].trigger === null)
				throw new DeviceRadio.Compiler.CompilerException("Variable does not have a trigger", args[0]);
			that._t[that._s[args[0].name].trigger].source.push(sub);
			that._t[that._s[args[0].name].trigger]['conditional'] = false;
		}
		else if (args[0].type === "VARIABLE") {
			if (args[0].bits !== null)
				throw new DeviceRadio.Compiler.CompilerException("Bit size casting not supported by this operation", args[0]);
			if (args[0].invert)
				throw new DeviceRadio.Compiler.CompilerException("Unexpected '!'", args[0]);
			if (that._v[args[0].name].trigger === null)
				throw new DeviceRadio.Compiler.CompilerException("Variable does not have a trigger", args[0]);
			that._t[that._v[args[0].name].trigger].source.push(sub);
			that._t[that._v[args[0].name].trigger]['conditional'] = false;
		}
		else throw new DeviceRadio.Compiler.CompilerException("Argument does not have a trigger", args[0]);
	},
	
	// generate instruction
	compile: function(state, call, regs, args) {
		var that = this.that;
		
		if (call == "") {
			var trigger = null;
			if (args[0].type === "TRIGGER") trigger = args[0].name;
			else if (args[0].type === "SYMBOL") trigger = that._s[args[0].name].trigger;
			else if (args[0].type === "VARIABLE") trigger = that._v[args[0].name].trigger;
			if (trigger !== null && 'id' in that._t[trigger]) state.api.trigger(that._t[trigger].id);
		}
	}
};
