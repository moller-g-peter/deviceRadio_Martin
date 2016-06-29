DeviceRadio.Compiler.prototype.objects['and'] = {
	// template
	template: {
		calls: {
			'': {
				reg: [0, 1, 'o'],
				mod: [true, true, "write"],
				flexible: true
			}
		}
	},

	// analyze call
	analyze: function(sub, call, regs, args) {
		var that = this.that;
		
		// size of output
		var bits = that._v[regs[2].name].bits;
		
		// validate and log usage
		if (regs[0].type === "INTEGER") {
			if (regs[0].bits > bits) throw new DeviceRadio.Compiler.CompilerException("Argument 1 must not be larger than the output variable", regs[0]);
			regs[0].bits = bits;
		}
		else {
			if (((regs[0].bits !== null) ? regs[0].bits : that._v[regs[0].name].bits) != bits)
				throw new DeviceRadio.Compiler.CompilerException("Argument 1 must be the same size as the output variable", regs[0]);
			// log access
			that._v[regs[0].name].read.push(sub);
			if (that._v[regs[0].name].write.indexOf(sub) < 0) that._v[regs[0].name].depend.push(sub);
		}
		if (regs[1].type === "INTEGER") {
			if (regs[1].bits > bits) throw new DeviceRadio.Compiler.CompilerException("Argument 2 must not be larger than the output variable", regs[1]);
			regs[1].bits = bits;
		}
		else {
			if (((regs[1].bits !== null) ? regs[1].bits : that._v[regs[1].name].bits) != bits)
				throw new DeviceRadio.Compiler.CompilerException("Argument 2 must be the same size as the output variable", regs[1]);
			// log access
			that._v[regs[1].name].read.push(sub);
			if (that._v[regs[1].name].write.indexOf(sub) < 0) that._v[regs[1].name].depend.push(sub);
		}
		that._v[regs[2].name].write.push(sub);
		
		// log trigger usage
		if (that._v[regs[2].name].trigger !== null) that._t[that._v[regs[2].name].trigger].source.push(sub);
	},
	
	// generate instruction
	compile: function(state, call, regs, args) {
		state.api.push(0x01);
	}
};
DeviceRadio.Compiler.prototype.objects['or'] = {
	// template
	template: {
		calls: {
			'': {
				reg: [0, 1, 'o'],
				mod: [true, true, "write"],
				flexible: true
			}
		}
	},
	
	// analyze call
	analyze: function(sub, call, regs, args) {
		this.that.objects.and.analyze(sub, call, regs, args);
	},
	
	// generate instruction
	compile: function(state, call, regs, args) {
		state.api.push(0x02);
	}
};
DeviceRadio.Compiler.prototype.objects['xor'] = {
	// template
	template: {
		calls: {
			'': {
				reg: [0, 1, 'o'],
				mod: [true, true, "write"],
				flexible: true
			}
		}
	},
	
	// analyze call
	analyze: function(sub, call, regs, args) {
		this.that.objects.and.analyze(sub, call, regs, args);
	},
	
	// generate instruction
	compile: function(state, call, regs, args) {
		state.api.push(0x03);
	}
};
DeviceRadio.Compiler.prototype.objects['not'] = {
	// template
	template: {
		calls: {
			'': {
				reg: [0, 'o'],
				mod: [true, "write"]
			}
		}
	},

	// analyze call
	analyze: function(sub, call, regs, args) {
		var that = this.that;
		
		// size of output
		var bits = that._v[regs[1].name].bits;
		
		// validate and log usage
		if (regs[0].type === "INTEGER") {
			if (regs[0].bits > bits) throw new DeviceRadio.Compiler.CompilerException("Argument 1 must not be larger than the output variable", regs[0]);
			regs[0].bits = bits;
		}
		else {
			if (((regs[0].bits !== null) ? regs[0].bits : that._v[regs[0].name].bits) != bits)
				throw new DeviceRadio.Compiler.CompilerException("Argument 1 must be the same size as the output variable", regs[0]);
			// log access
			that._v[regs[0].name].read.push(sub);
			if (that._v[regs[0].name].write.indexOf(sub) < 0) that._v[regs[0].name].depend.push(sub);
		}
		that._v[regs[1].name].write.push(sub);

		// log trigger usage
		if (that._v[regs[1].name].trigger !== null) that._t[that._v[regs[1].name].trigger].source.push(sub);
	},
	
	// generate instruction
	compile: function(state, call, regs, args) {
		state.api.push(0x00);
	}
};