DeviceRadio.Compiler.prototype.objects['debug'] = {
	// template
	template: {
		calls: {
			'clear': {
			},
			'nop': {
				mod: []
			}
		}
	},
	
	// generate instruction
	compile: function(state, call, regs, args, opt) {
		if (call == "nop") state.api.push(0x00);
	}
};
