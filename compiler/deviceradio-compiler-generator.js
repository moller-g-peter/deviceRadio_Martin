// generate the byte code
DeviceRadio.Compiler.prototype.generate = function (project, revision) {
	if (this.error) throw new DeviceRadio.Compiler.CompilerException("Compiler is in an error state");
	if (!this.optimized) throw new DeviceRadio.Compiler.CompilerException("Code must pass through the optimizer first");
	this.error = true;
	var that = this;

	// setup project and revision
	if (typeof revision !== "number") revision = 0;
	var project = [];
	for (var i = 0; i < 16; i++) {
		project.push(Math.floor(Math.random() * 0xff));
	}

	// find array in array
	var findArray = function(large, small) {
		if (large.length < small.length || large.length == 0 || small.length == 0) return -1;
		for (var i = 0; i <= (large.length - small.length); i++) {
			var found = true;
			for (var j = 0; j < small.length; j++) {
				if (large[i + j] != small[j]) {
					found = false;
					break;
				}
			}
			if (found) return i;
		}
		return -1;
	};
	
	// clone an object
	function clone(obj) {
		if (null === obj || "object" !== typeof obj) return obj;
		var copy = obj.constructor();
		for (var attr in obj) {
			if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
		}
		return copy;
	}

	// allocate addresses to variables
	var allocateVariables = function(reserved_bytes) {
		
		var alloc = 0;
		var bit_pack = null;
		
		// loop all variables
		for (var key in that._v) {
			if (!that._v.hasOwnProperty(key) || that._v[key].status !== "ram") continue;
			var variable = that._v[key];
			
			// check if aligned
			var align = ('align' in variable) ? variable.align : false;
			
			// pack bits together
			if (!align && variable.size == 1 && bit_pack !== null) {
				variable['address'] = bit_pack++;
				if (!(bit_pack & 7)) bit_pack = null;
			}
			else {
				var bytes = (variable.size & 7) ? (variable.size >> 3) + 1 : variable.size >> 3;
				variable['address'] = (reserved_bytes + alloc) * 8;
				if (!align && variable.size == 1) bit_pack = variable['address'] + 1;
				alloc += bytes;
			}
		}
		
		return alloc;
	};
	
	// resolve memory symbols
	var resolveMemory = function(reserved_bytes, configure_added) {
		// loop symbols
		for (var i = 0; i < that._compiler.symbols.length; i++) {
			var symbol = that._compiler.symbols[i];
			var address, mutex;
			
			// handle the source
			var what = symbol.what[0];
			switch (symbol.what[0]) {
			case "ram":
				{
					var v = that._v[symbol.what[1]];
					var index = (symbol.what.length > 2 && symbol.what[2] !== null) ? symbol.what[2] : 0;
					var offset = index * v.size;
					// calculate nested offset
					var p = v;
					while (true) {
						offset += ('offset' in p) ? p.offset : 0;
						if ('parent' in p && p.parent !== null) p = that._v[p.parent];
						else break;
					}
					address = p.address + offset;
				}
				break;
			case "conf":
				if (configure_added !== true) continue;
				address = that._s[symbol.what[1]].address;
				break;
			case "temp":
				address = (reserved_bytes * 8) + symbol.what[1] + symbol.what[2];
				break;
			case "const":
				{
					var v = that._v[symbol.what[1]];
					address = that._c[v.const].address;
				}
				break;
			case "mutex":
				mutex = 0xff;
				if (symbol.what[1] in that._m) {
					var m = that._m[symbol.what[1]];
					if ('id' in m) mutex = m.id;
				}
				break;
			case "resolved":
				continue;
				break;
			default:
				throw new Error("Not implemented");
			}
			symbol.what[0] = "resolved";
			
			// handle the destination
			switch (symbol.where[0]) {
			case "code":
				that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.PROGRAMS][symbol.where[2]] = address >> 8;
				that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.PROGRAMS][symbol.where[2] + 1] = address & 0xff;
				break;
			case "conf":
				that._s[symbol.where[1]]['data'][symbol.where[2]] = address >> 8;
				that._s[symbol.where[1]]['data'][symbol.where[2] + 1] = address & 0xff;
				break;
			case "bconf":
				if (what == "mutex") {
					that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.BOOT_CONFIG][symbol.where[2]] = mutex;
				}
				else {
					if (symbol.where[1] === true) address >>= 3;
					that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.BOOT_CONFIG][symbol.where[2]] = address >> 8;
					that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.BOOT_CONFIG][symbol.where[2] + 1] = address & 0xff;
				}
				break;
			default:
				throw new Error("Not implemented");
			}
		}
	};
	
	// generate mutex chunk
	var genMutexes = function() {
		// locks
		var lut = [];
		var lock = [];

		// assign ids
		for (var mutex in that._m) {
			if (!that._m.hasOwnProperty(mutex)) continue;
			var object = that._m[mutex];
			
			// get all tasks associated with the mutex
			var tasks = [];
			for (var i = 0; i < object.lock.length; i++) {
				var task = that._s[object.lock[i]];
				if ('id' in task && tasks.indexOf(task.id) < 0) tasks.push(task.id);
			}
			tasks.sort();
			
			// assign id
			if (tasks.length > 0) {
				object['id'] = lut.length;
				
				// add mutex lookup and tasks to lock
				lut.push(lock.length);
				lock = lock.concat(tasks);
				lock.push(0xff); // end of lock list
			}
		}
		if (lut.length > that.capabilities.max_mutexes)
			throw new DeviceRadio.Compiler.CompilerException("Maximum number of mutexes exeeded");
		if (lock.length > 256)
			throw new DeviceRadio.Compiler.CompilerException("Mutex locking is to complex. Reduce number of associated tasks");

		// add the chunks
		if (lut.length > 0) {
			that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.MUTEX_LUT] = lut;
			that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.MUTEX_LIST] = lock;
		}

		return lut.length;
	};
	
	// generate configuration chunks
	var genConfiguration = function() {

		// loop all symbols
		var configs = [];
		for (var key in that._s) {
			if (!that._s.hasOwnProperty(key)) continue;
			var symbol = that._s[key];
			if ('conf' in symbol && 'data' in symbol) {
				configs.push(key);
			}
		}
		// sort on size
		configs.sort(function (a, b) {
			return that._s[b]['data'].length - that._s[a]['data'].length;
		});

		// build the table
		var chunk = [];
		for (var i = 0; i < configs.length; i++) {
			var symbol = that._s[configs[i]];
			var pos = findArray(chunk, symbol['data']);
			if (pos < 0) {
				symbol['address'] = chunk.length;
				chunk = chunk.concat(symbol['data']);
			}
			else {
				symbol['address'] = pos;
			}
		}

		// add chunk
		that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.MODULE_CONFIGS] = chunk;
	};

	// generate the const tables
	var genConstants = function() {		
		// generate constants for variables
		for (var key in that._v) {
			if (!that._v.hasOwnProperty(key)) continue;
			var variable = that._v[key];
			if (variable.status == "const") {
				// array alignment is a bit different if const vs ram
				if (variable.array !== null) {
					var v;
					if (variable.value === null || variable.value.length == 0) v = [];
					else if (Object.prototype.toString.call( variable.value[0] ) === '[object Array]') v = variable.value;
					else v = [variable.value];
					while (v.length < variable.array) v.push([0]);
					variable.value = v;
				}
				variable['const'] = that.createConst(variable.bits, variable.value, true);
			}
			else if (variable.status != "skip" && variable.value !== null && (variable.value.length > 1 || variable.value[0] > 0))
				variable['const'] = that.createConst(variable.bits, variable.value);
		}
		
		// adjust constants size
		var constants = [];
		for (var key in that._c) {
			var c = that._c[key];
			var size = c.bits * c.array;
			if (size & 7) size = ((size >> 3) + 1) << 3;
			var bytes = size >> 3;
			while (c.value.length < bytes) c.value.push(0);
			c['size'] = size;
			constants.push(key);
		}
		// sort on size
		constants.sort(function (a, b) {
			return that._c[b].size - that._c[a].size;
		});
		
		// build the table
		var table = [];
		for (var i = 0; i < constants.length; i++) {
			var constant = that._c[constants[i]];
			var pos = findArray(table, constant.value);
			if (pos < 0) {
				constant['address'] = table.length * 8;
				table = table.concat(constant.value);
			}
			else {
				constant['address'] = pos * 8;
			}
		}

		// add chunk
		that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.CONSTANTS] = table;
	};

	// assign numbers triggers
	var genAssignTriggers = function () {
		// list of assigned triggers
		var ret = [];
		
		// master boot
		if (that.reset !== null) {
			that._t[that.reset]['id'] = 0;
			ret.push(that.reset);
		}
		else throw new DeviceRadio.Compiler.CompilerException("Program does not have a reset handler.");
		
		// generate constants for variables
		var id = 1;
		for (var key in that._t) {
			if (!that._t.hasOwnProperty(key)) continue;
			var trigger = that._t[key];
			if ('id' in trigger) continue;
			if (trigger.status == "create") {
				trigger['id'] = id++;
				ret.push(key);
			}
			else if (trigger.status == "merge") {
				if ('id' in that._t[trigger.alias]) trigger['id'] = that._t[trigger.alias].id;
				else {
					that._t[trigger.alias]['id'] = id;
					trigger['id'] = id++;
				}
			}
		}
		
		return ret;
	};

	// compile
	var genCompile = function(object) {
		// code
		var code = object.code;
		// revision counter
		var rev = 0;
		// program counter
		var pc;
		
		// temporary memory
		var temporaryUsed = 0;
		var temporaryAlloc = {};
		var temporaryBitpack = null; // pack 8 bits into a byte
		
		// keep track of triggered triggers
		var triggered = [];
		
		// compiler state
		var state = {
			cond: true,
			register: 0,
			regs: [],
			api: {}
		};
		for (var i = 0; i < that.capabilities.registers; i++) {
			state.regs.push({
				loaded: null, // consistent name of what is loaded
				object: null, // source object
				changed: false, // true if value has changed and need to be saved
				where: null, // where it is located (reg, ram, conf, rom, temp)
				needed: false, // number of OPCs until the loaded is needed
				needed_at: 0, // in what register it is needed
				rev: rev++
			});
		}
		
		// log functions
		var registersToString = function (prefix) {
			ret = "";
			prefix = (typeof prefix === "string") ? prefix : "";
			for (var i = 0; i < state.regs.length; i++) {
				var reg = state.regs[i];
				ret += prefix + "Register" + i + ": ";
				if (reg.loaded === null) ret += "empty";
				else {
					ret += reg.loaded + " (in " + reg.where;
					if (reg.changed) ret += ", is changed";
					ret += ")";
				}
				ret += "\n";
			}
			ret += prefix + "Register pointer: " + state.register + "\n";
			return ret;
		};
		var callToString = function (prefix, obj) {
			prefix = (typeof prefix === "string") ? prefix : "";
			ret = prefix + "Calling function \"";
			if (obj.call == "") ret += obj.base;
			else ret += obj.base + "." + obj.call;
			ret += "\" in \"" + that._ns[obj.ns].title + "\" [" + obj.row + ":" + obj.col + "]\n";
			return ret;
		};
		var codeToString = function (prefix, from, to) {
			prefix = (typeof prefix === "string") ? prefix : "";
			if (from == to) return prefix + "No code\n";
			var x = 0;
			var ret = "";
			for (var i = from; i < to; i++) {
				if (x >= 19) {
					x = 0;
					ret += ",\n";
				}
				if (x == 0) ret += prefix;
				else ret += ", ";
				x++;
				var octet = that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.PROGRAMS][i];
				if (typeof octet === "string") ret += '??';
				else {
					octet = octet.toString(16).toUpperCase();
					if (octet.length == 1) octet = "0" + octet;
					ret += octet;
				}
			}
			return ret + "\n";
		};
		
		// select a register
		state.api.select = function (r) {
			if (state.register != r) {
				state.api.push(0x80 | r);
				state.register = r;
			}
		};
		// get a list of triggers for a variable
		state.api.getTriggers = function (name) {
			var v = that._v[name];
			var triggers;
			// get list of triggers
			if (v.trigger === null) triggers = [];
			else if (Object.prototype.toString.call( v.trigger ) !== '[object Array]') triggers = [v.trigger];
			else triggers = v.trigger;
			// only include valid triggers
			var ret = [];
			for (var i = 0; i < triggers.length; i++) {
				if (('id' in that._t[triggers[i]]) && ret.indexOf(that._t[triggers[i]].id) < 0)
					ret.push(that._t[triggers[i]].id);
			}
			return ret;
		};
		// free a register
		state.api.free = function (r, keep_register) {
			var save = false;
			if (state.regs[r].loaded !== null) {
				var reg = state.regs[r];
				if (reg.changed && typeof reg.object !== "string" && reg.object.type === "VARIABLE") {
					var o = reg.object;
					var v = that._v[o.name];
					var cname = state.api.name(o);
					var bname = state.api.name(o, true);
					var parent = v;
					while ('parent' in parent && parent.parent !== null) parent = that._v[parent.parent];
					save = (parent.status === "ram" || parent.status === "temp");
					// it is a temporary, check if it should be kept
					if (save && parent.status === "temp") {
						if (state.api.name_needed(cname) === null) save = false;
					}
					if (save && reg.where === "temp") {
						// look ahead and see if it will be used again
						if (bname !== cname && state.api.name_needed(cname) === null) save = false;
					}
					if (save && parent.status === "ram") {
						if (bname !== cname) save = false;
					}
					// standard variables
					if (save) {
						// get list of triggers
						var triggers = state.api.getTriggers(o.name);
						if (triggers.length > 0) {
							// save
							state.api.select(r);
							state.api.push(0xca);
							state.api.push((parent.status === "ram") ? state.api.ramAddress(o.name, o.index) : state.api.tempAddress(o));
							state.api.push(triggers[0]);
							if (triggers.length > 1) {
								for (var i = 1; i < triggers.length; i++) {
									state.api.push(0xcc);
									state.api.push(triggers[i]);
								}
							}
							state.register++;
							state.api.cond = false;
						}
						else if (reg.where !== "ram") {
							// save
							state.api.select(r);
							state.api.push(0xc9);
							state.api.push((parent.status === "ram") ? state.api.ramAddress(o.name, o.index) : state.api.tempAddress(o));
							state.register++;
							state.api.cond = false;
						}
					}
				}
				if (keep_register !== true) reg.loaded = null;
			}
			return save;
		};
		// get address to ram variable
		state.api.ramAddress = function (name, index) {
			index = (typeof index === "number") ? index : null;
			that._compiler.symbols.push({
				what: ['ram', name, index],
				where: ['code', null, state.api.getAddress()]
			});
			return ['??', '??'];
		};
		// get address to temp variable from object
		state.api.tempAddress = function (o) {
			var cname = state.api.name(o);
			var bname = state.api.name(o, true);
			var v = that._v[o.name];
			var bits = (o.bits !== null) ? o.bits : v.bits;
						
			// if a nested variable, only allocate its parent
			var nested = (('parent' in v && v.parent !== null) || v.children.length > 0);
			var offset = 0;
			if (nested && cname === bname) {
				// add index offset
				if (o.index !== null) {
					offset = (bits > that.capabilities.max_arg_bits && (bits & 7)) ? ((bits >> 3) + 1) << 3 : bits;
					offset *= o.index;
				}
				// add nested offset
				var p = v;
				cname = o.name;
				while (true) {
					offset += ('offset' in p) ? p.offset : 0;
					// go up a level
					if ('parent' in p && p.parent !== null) {
						cname = p.parent;
						p = that._v[p.parent];
					}
					else break;
				}
				// change reference
				bits = p.size;
			}
			
			var addr = state.api.getTemporary(cname, bits);
			that._compiler.symbols.push({
				what: ['temp', cname, addr, offset],
				where: ['code', null, state.api.getAddress()]
			});
			return ['??', '??'];
		};
		// get address to conf structure
		state.api.confAddress = function (name) {
			that._compiler.symbols.push({
				what: ['conf', name],
				where: ['code', null, state.api.getAddress()]
			});
			return ['??', '??'];
		};
		// get address to rom variable
		state.api.romAddress = function (name, offset) {
			offset = (typeof offset === "number") ? offset : 0;
			var addr = that._c[name].address + offset;
			return [addr >> 8, addr & 0xff];
		};
		// set a trigger
		state.api.trigger = function (t) {
			if (t < 0xff && triggered.indexOf(t) < 0) {
				triggered.push(t);
				if (!state.cond) {
					state.api.push(0xf2);
					state.cond = true;
				}
				state.api.push(0xcc);
				state.api.push(t);
			}
		};
		// copy a register
		state.api.copy = function (to, from, move) {
			if (state.regs[from].loaded === "const/true.1") {
				state.api.select(to);
				state.api.push(0xf1);
				state.register++;
			}
			else if (state.regs[from].loaded === "const/false.1") {
				state.api.select(to);
				state.api.push(0xf0);
				state.register++;
			}
			else {
				state.api.select(from);
				state.api.push(0x98 | to);
				state.register = to;
			}
			state.regs[to] = clone(state.regs[from]);
			if (move !== true) {
				state.regs[to].rev = rev++;
				// a crude write protect to force a copy if needed
				if (state.regs[to].where == "ram" || state.regs[to].where == "temp") state.regs[to].where = "rom";
			}
			else state.regs[from].loaded = null;
		};
		// move a register
		state.api.move = function (to, from) {
			state.api.copy(to, from, true);
		};
		// cast a register
		state.api.cast = function (r, o) {
			var bits = (o.bits !== null) ? o.bits : that._v[o.name].bits;
			// select register to cast
			state.api.select(r);
			// simple cast
			if (bits <= that.capabilities.max_arg_bits) {
				state.api.push(0xD4);
				state.api.push(bits);
				state.regs[r].where = "reg";
			}
			// cast using a temporary register
			else {
				state.api.push(0xD6);
				state.api.push(bits);
				state.api.push(state.api.tempAddress(o));
				state.regs[r].where = "temp";
			}
		};
		// invert a register
		state.api.invert = function (r) {
			state.api.push(0x88 | r);
		};
		// load object (ram, rom or conf) into register
		state.api.load = function (r, obj) {
			state.api.select(r);
			state.regs[r].loaded = state.api.name(obj, true);
			state.regs[r].changed = false;
			state.regs[r].rev = rev++;
			// configuration
			if (typeof obj === "string") {
				var s = that._s[obj];
				state.regs[r].where = "conf";
				var conf = ('data' in s && s['data'].length > 0) ? s['data'] : null;
				state.api.push(0xD2);
				if (conf !== null) {
					state.api.push(state.api.confAddress(obj));
					state.api.push(conf.length);
				}
				else state.api.push([0x00, 0x00, 0x00]);
			}
			// ram
			else if (obj.type == "VARIABLE") {
				var v = that._v[obj.name];
				
				var nested = (('parent' in v && v.parent !== null) || v.children.length > 0);
				var parent = v;
				while ('parent' in parent && parent.parent !== null) parent = that._v[parent.parent];
				
				if (parent.status == "ram") {
					state.api.push(0xC2);
					state.api.push(state.api.ramAddress(obj.name, obj.index));
					state.api.push(v.bits);
					state.regs[r].where = (v.bits > that.capabilities.max_arg_bits) ? "ram" : "reg";
				}
				else if (parent.status == "const") {
					// calculate offset
					var offset = 0;
					if (obj.index !== null) {
						offset = (v.bits > that.capabilities.max_arg_bits && (v.bits & 7)) ? ((v.bits >> 3) + 1) << 3 : v.bits;
						offset *= obj.index;
					}
					var p = v;
					while (true) {
						offset += ('offset' in p) ? p.offset : 0;
						if ('parent' in p && p.parent !== null) p = that._v[p.parent];
						else break;
					}
					state.api.push(0xC6);
					state.api.push(state.api.romAddress(parent['const'], offset));
					state.api.push(v.bits);
					state.regs[r].where = (v.bits > that.capabilities.max_arg_bits) ? "rom" : "reg";
				}
				else {
					state.api.push(0xC2);
					state.api.push(state.api.tempAddress(obj));
					state.api.push(v.bits);
					state.regs[r].where = (v.bits > that.capabilities.max_arg_bits) ? "ram" : "reg";
				}
			}
			// rom
			else {
				if (obj['const'] === null) {
					if (obj.value === null || obj.value[0] == 0) state.api.push(0xF0);
					else state.api.push(0xF1);
					state.regs[r].where = "reg";
				}
				else {
					state.api.push(0xC6);
					state.api.push(state.api.romAddress(obj['const']));
					state.api.push(obj.bits);
					state.regs[r].where = (obj.bits > that.capabilities.max_arg_bits) ? "rom" : "reg";
				}
			}
			state.register++;
		};
		// swap two registers
		state.api.swap = function (r1, r2) {
			var tmp;
			if (r2 == state.register) {
				tmp = r1;
				r1 = r2;
				r2 = tmp;
			}
			state.api.select(r1);
			state.api.push(0xB0 | r2);
			state.register = r2;
			tmp = state.regs[r1];
			state.regs[r1] = state.regs[r2];
			state.regs[r2] = tmp;
		};
		// lookup a register to see in how many OPCs it will be needed
		state.api.name_needed = function (name) {
			if (name === null || pc >= code.length) return null;
			var ahead = 0;
			var needed = null;
			var needed_at = 0;
			var needed_as_base = null;
			var needed_as_base_at = 0;
			var needed_as_cname = null;
			for (var p = pc + 1; p < code.length; p++) {
				var opc = code[p];
				// loop opc registers
				for (var j = 0; j < opc.reg.length; j++) {
					var opc_reg = opc.reg[j];
					var cname, bname;
					if (typeof opc_reg === "string") cname = bname = state.api.name(opc_reg);
					else {
						if (!('cname' in opc_reg)) opc_reg['cname'] = state.api.name(opc_reg);
						if (!('bname' in opc_reg)) opc_reg['bname'] = state.api.name(opc_reg, true);
						cname = opc_reg.cname;
						bname = opc_reg.bname;
					}
					if (name === cname) {
						if (needed === null) {
							needed = ahead;
							needed_at = j;
						}
					}
					else if (name === bname) {
						if (needed_as_base === null) {
							needed_as_base = ahead;
							needed_as_base_at = j;
							needed_as_cname = cname;
						}
					}
				}
				if (needed !== null && needed_as_base !== null) break;
				ahead++;
			}
			var use_as = false;
			if (needed_as_base !== null) {
				if (needed === null || needed > needed_as_base) {
					if (state.api.find(needed_as_cname) === null) use_as = true;
				}
			}
			if (use_as) {
				return [needed_as_base, needed_as_base_at];
			}
			else if (needed !== null) {
				return [needed, needed_at];
			}
			return null;
		};
		// name needed
		state.api.reg_needed = function (r) {
			return state.api.name_needed(state.regs[r].loaded);
		}
		// clean up unused registers
		state.api.clean = function () {
			// remove duplicate registers
			for (var i = 0; i < state.regs.length; i++) {
				var reg = state.regs[i];
				if (reg.loaded === null) continue;
				// look for duplicates
				var bname = (reg['object'] === null) ? reg.loaded : state.api.name(reg['object'], true);
				for (var j = 0; j < state.regs.length; j++) {
					if (j != i && bname === state.regs[j].loaded) {
						if (reg.rev < state.regs[j].rev) {
							reg.loaded = null;
							break;
						}
					}
				}
				// reset needed flag
				reg.needed = false;
			}
			// look ahead and see in how many OPCs it will be needed
			for (var i = 0; i < state.regs.length; i++) {
				var needed = state.api.reg_needed(i);
				if (needed !== null) {
					state.regs[i].needed = needed[0];
					state.regs[i].needed_at = needed[1];
				}
			}
			// remove unneeded registers
			for (var i = 0; i < state.regs.length; i++) {
				var reg = state.regs[i];
				if (reg.loaded !== null && reg.needed === false) {
					state.api.free(i);
				}
			}
		};
		// get a consistent name [name, base name, inverted]
		state.api.name = function (obj, bname) {
			var name;
			bname = (bname === true);
			// config
			if (typeof obj === "string") {
				name = "conf/" + obj;
			}
			// exists
			else if (!bname && 'cname' in obj) name = obj.cname;
			else if (bname && 'bname' in obj) name = obj.bname;
			// integer
			else if (obj.type == "INTEGER") {
				var c = obj['const'];
				if (c === null) {
					c = (obj.value === null || obj.value[0] == 0) ? "false.1" : "true.1";
				}
				else c += "." + obj.bits;
				name = "const/" + c;
			}
			// variable
			else if (obj.type == "VARIABLE") {
				var index = (obj.index !== null) ? obj.index : 0;
				var variable = that._v[obj.name];
				if (bname)
					name = "var/" + obj.name + "." + variable.bits + "[" + index + "]";
				else
					name = "var/" + ((obj.invert) ? "!" : "") + obj.name + "." + ((obj.bits !== null) ? obj.bits : variable.bits) + "[" + index + "]";
			}
			// unique name
			return name;
		};
		// check where a variable will be used the next time, negative value if no perfect match is found
		state.api.where = function (name) {
			var ret = null;
			var max = 0;
			// look ahead for the variable
			for (var i = 0; i < 5; i++) {
				var p = pc + 1 + i;
				if (p >= code.length) break;
				var opc = code[p];
				for (var j = 0; j < opc.reg.length; j++) {
					if (name === state.api.name(opc.reg[j], true) && j >= max) {
						ret = j;
						break;
					}
				}
				if (ret !== null) break;
				if (opc.reg.length > max) {
					var flexible = ('flexible' in that.objects[opc.base].template.calls[opc.call]) ? that.objects[opc.base].template.calls[opc.call].flexible : false;
					if (!flexible || opc.reg.length > 2) max = opc.reg.length;
				}
			}
			if (max >= state.regs.length) max = state.regs.length - 1;
			return (ret !== null) ? ret : -max;
		};
		// find what register holds an argument, null if not found
		state.api.find = function (name) {
			for (var i = 0; i < state.regs.length; i++) {
				if (state.regs[i].loaded === name) return i;
			}
			return null;
		};
		// push code
		state.api.push = function (data) {
			if (Object.prototype.toString.call( data ) === '[object Array]') {
				that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.PROGRAMS] = that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.PROGRAMS].concat(data);
			}
			else that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.PROGRAMS].push(data);
		};
		// get code position
		state.api.getAddress = function () {
			return that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.PROGRAMS].length;
		}
		// get bit-address to temporary memory
		state.api.getTemporary = function(cname, bits) {
			if (!(cname in temporaryAlloc)) {
				if (bits == 1 && temporaryBitpack !== null) {
					temporaryAlloc[cname] = {
						address: temporaryBitpack++
					};
					if (!(temporaryBitpack & 7)) temporaryBitpack = null;
				}
				else {
					var bytes = (bits & 7) ? (bits >> 3) + 1 : bits >> 3;
					temporaryAlloc[cname] = {
						address: temporaryUsed * 8
					};
					if (bits == 1) temporaryBitpack = (temporaryUsed * 8) + 1;
					temporaryUsed += bytes;
				}
			}
			return temporaryAlloc[cname].address;
		}
		
		// add address
		object.address = state.api.getAddress();
		object.sub_type = 0;
		
		// loop instructions
		for (pc = 0; pc < code.length; pc++) {
			var opc = code[pc];
			var base = that.objects[opc.base];

			// build log strings
			var logRegistersBefore = registersToString("#     ");
			var logRegistersAfter;
			var logFunctionCall = callToString("# ", opc);
			var logAddressStart = state.api.getAddress();
			var logAddressPre;
			var logAddressOpc;
			var logAddressPost;

			// check what we will need for the call
			var need = [];
			var need_cname = [];
			var flexible = false; // flexible inputs and outputs
			for (var i = 0; i < opc.reg.length; i++) {
				var cname = state.api.name(opc.reg[i]);
				var bname = state.api.name(opc.reg[i], true);
				need.push((state.api.find(cname) !== null) ? cname : bname);
				need_cname.push(cname);
			}
			while (need.length < state.regs.length) need.push(true);
			if ('flexible' in base.template.calls[opc.call]) flexible = base.template.calls[opc.call].flexible;
			
			// check what is modified
			var mod = [];
			if ('mod' in base.template.calls[opc.call]) {
				for (var i = 0; i < base.template.calls[opc.call].mod.length; i++)
					mod.push(base.template.calls[opc.call].mod[i])
				while (mod.length < state.regs.length) mod.push(true);
			}
			else {
				for (var i = 0; i < state.regs.length; i++) mod.push(null);
			}
			
			// check how it will look after
			var after = [];
			for (var i = 0; i < mod.length; i++) {
				if (mod[i] === null) after.push(null);
				else if (i < need_cname.length) after.push(need_cname[i]);
				else after.push(true);
			}
			
			// helper to get best free
			var getBestFree = function(where) {
				if (where !== null && after[where] === true && state.regs[where].loaded === null) return where;
				var i = state.regs.length;
				while (i--) {
					if (after[i] === true && state.regs[i].loaded === null) return i;
				}
				return state.regs.length - 1;
			};
			
			// handle flexible args
			var swap = [0, 1];
			if (flexible) {
				// store or load from any register
				if (opc.reg.length == 1) {
					var where = 0;
					// see were the arg will be used
					if (mod[0] === "write") {
						where = state.api.where(after[0]);
						if (where < 0) where = getBestFree(-where);
					}
					// see if the arg is loaded
					else if (mod[0] === true) {
						where = state.api.find(need[0]);
						if (where === null) {
							where = state.api.where(need[0]);
							if (where < 0) where = getBestFree(-where);
						}
					}
					// find an empty register
					else if (mod[0] === null) {
						for (var i = 1; i < state.regs.length; i++) {
							if (after[i] === true && state.regs[i].loaded === null) {
								where = i;
								break;
							}
						}
					}
					// swap registers
					if (where > 0) {
						var tmp = after[where];
						after[where] = after[0];
						after[0] = tmp;
						
						tmp = need[where];
						need[where] = need[0];
						need[0] = tmp;
						
						tmp = mod[where];
						mod[where] = mod[0];
						mod[0] = tmp;
						
						swap[0] = where;
						
						if (where == 1) swap[1] = 0;
					}
				}
				// in/out can be different registers or the same
				else if (opc.reg.length == 2) {
					if (mod[0] === true && (mod[1] === "write" || mod[1] === "copy")) {
						var where0 = state.api.where(need[0]);
						var where1 = state.api.where(after[1]);
						if (need[0] === after[1] || (where0 <= 0 && where1 <= 0)) {
							// select the register to use
							var where = state.api.find(need[0]);
							if (where === null) where = (where0 < 0) ? getBestFree(-where0) : where0;
							swap[0] = where;
							swap[1] = where;
						}
						else {
							var where_is_0 = state.api.find(need[0]);
							if (where_is_0 !== null) swap[0] = where_is_0;
							if (where1 >= 0) swap[1] = where1;
							else swap[1] = swap[0];
						}
					}
					// handle swapping
					if ((swap[0] != 0) || (swap[1] != 1)) {
						var new_need_in = need[0];
						var new_need_out = need[1];
						var new_after = after[1];
						var new_mod = mod[1];
						// reset old
						need[0] = true;
						need[1] = true;
						after[0] = true;
						after[1] = true;
						mod[0] = true;
						mod[1] = true;
						// restore new
						need[swap[0]] = new_need_in;
						if (swap[0] != swap[1]) need[swap[1]] = new_need_out;
						after[swap[1]] = new_after;
						mod[swap[1]] = new_mod;
					}
				}
				// the two first registers can be swapped if better
				else if (opc.reg.length > 2 && mod[0] === true && mod[1] === true) {
					// only check to swap if first register is not in place
					var where_is_0 = state.api.find(need[0]);
					var where_is_1 = state.api.find(need[1]);
					var do_swap = false;
					if (where_is_0 === null || where_is_0 != 0) {
						if (where_is_0 === null && where_is_1 !== null) do_swap = true;
						else if (where_is_0 !== null && where_is_1 !== null && (where_is_0 > where_is_1 && where_is_1 != 1)) do_swap = true;
					}
					if (do_swap) {
						var tmp;
						tmp = need[0];
						need[0] = need[1];
						need[1] = tmp;
						tmp = after[0];
						after[0] = after[1];
						after[1] = tmp;
					}
				}
			}

			// decide what to keep, with the highest priority first
			var keep = 0;
			var candidates = [];
			for (var i = 0; i < after.length; i++) {
				// empty slot found for something to keep
				if (after[i] === true) keep++;
				// evaluate what we have
				var reg = state.regs[i];
				if (reg.loaded !== null) {
					// see if already kept
					var found = false;
					for (var j = 0; j < after.length; j++) {
						if (typeof after[j] === "string" && reg.loaded === after[j]) {
							found = true;
							break;
						}
					}
					// check if it will be needed in the future
					if (!found) {
						var needed = state.api.reg_needed(i);
						if (needed !== null) {
							candidates.push({
								name: reg.loaded,
								register: i,
								needed: needed[0],
								needed_at: needed[1]
							});
						}
						else {
							for (var j = 0; j < after.length; j++) {
								if (reg.loaded === after[j]) {
									found = true;
									break;
								}
							}
							if (!found) {
								state.api.free(i, true);
							}
						}
					}
				}
			}

			// look for candidates in the intermediate registers
			for (var i = 0; i < need.length; i++) {
				if (typeof need[i] !== "string" || after[i] === need[i]) continue;
				// see if it is already marked for keeping
				var found = false;
				for (var j = 0; j < candidates.length; j++) {
					if (need[i] === candidates[j].name) {
						found = true;
						break;
					}
				}
				// check if needed in the future
				if (!found) {
					var needed = state.api.name_needed(need[i]);
					if (needed !== null) {
						candidates.push({
							name: need[i],
							register: -1,
							needed: needed[0],
							needed_at: needed[1]
						});
					}
				}
			}
			// sort by how urgently it will be needed, bonus if it is in the correct place
			candidates.sort(function (a, b) {
				var i_a, i_b;
				if (a.needed === false) i_a = 10000;
				else {
					i_a = a.needed;
					if (i_a > 1 && a.register === a.needed_at) i_a--;
				}
				if (b.needed === false) i_b = 10000;
				else {
					i_b = b.needed;
					if (i_b > 1 && b.register === b.needed_at) i_b--;
				}
				return i_a - i_b;
			});

			// unload things we can't keep
			if (candidates.length > keep) {
				// clear some registers
				for (var i = keep; i < candidates.length; i++) {
					if (candidates[i].register >= 0) {
						state.api.free(candidates[i].register);
					}
				}
				candidates = candidates.slice(0, keep);
			}
			
			// add the saved candidates to the needed
			for (var i = 0; i < candidates.length; i++) {
				var j = candidates[i].register;
				if (j >= 0 && need[j] === true) {
					need[j] = candidates[i].name;
					candidates[i]['done'] = true;
				}
			}
			for (var i = 0; i < candidates.length; i++) {
				if ('done' in candidates[i]) continue;
				for (j = 0; j < need.length; j++) {
					if (need[j] === true) {
						need[j] = candidates[i].name;
						candidates[i]['done'] = true;
						break;
					}
				}
			}
			
			// helpers for register loaded
			var getSwappedRegIn = function (r) {
				var ret;
				if (r == swap[0]) ret = 0;
				else if (r == swap[1]) ret = 1;
				else if (r < 2) ret = opc.reg.length;
				else ret = r;
				return ret;
			};
			var getSwappedRegOut = function (r) {
				var ret;
				if (r == swap[1]) ret = 1;
				else if (r == swap[0]) ret = 0;
				else if (r < 2) ret = opc.reg.length;
				else ret = r;
				return ret;
			};
			var getSwappedRegOutInv = function (r) {
				return (r < 2) ? swap[r] : r;
			}
			
			// recursive helper for vacating a register
			var vacateRegister = function _vacateRegister (r) {
				var reg = state.regs[r];
				if (reg.loaded === null) return;
				// find where it should go
				var cname_r = null;
				var bname_r = null;
				for (var i = 0; i < state.regs.length; i++) {
					if (i == r) continue;
					var target_r = getSwappedRegIn(i);
					var target_o = (target_r >= opc.reg.length) ? null : opc.reg[target_r];
					var cname = (target_o === null) ? need[i] : state.api.name(target_o);
					var bname = (target_o === null) ? cname : state.api.name(target_o, true);
					if (cname_r === null && reg.loaded === cname) cname_r = i;
					if (bname_r === null && reg.loaded === bname) bname_r = i;
				}
				var target = (cname_r !== null) ? cname_r : bname_r;
				// vacate the target register
				if (state.regs[target].loaded !== reg.loaded) {
					_vacateRegister(target);
					// move to target
					state.api.move(target, r);
				}
				// clear
				else reg.loaded = null;
			};
			
			// helper for loading an occupied register with another register
			var loadRegister = function (target, source) {
				// check if we have free registers to use
				var free = 0;
				for (var i = 0; i < state.regs.length; i++) if (state.regs[i].loaded === null) free++;
				// handle if the source is aldready in the right place
				var do_swap = true;
				if (free > 0) {
					var source_r = getSwappedRegIn(source);
					var source_o = (source_r >= opc.reg.length) ? null : opc.reg[source_r];
					var cname = (source_o === null) ? need[source] : state.api.name(source_o);
					var bname = (source_o === null) ? cname : state.api.name(source_o, true);
					if (cname === state.regs[source].loaded) do_swap = false;
					else if (bname === state.regs[source].loaded && state.api.find(cname) === null) do_swap = false;
				}
				if (do_swap) {
					state.api.swap(target, source);
				}
				else {
					vacateRegister(target);
					state.api.copy(target, source);
				}
			};

			// remove true from need
			for (var i = 0; i < need.length; i++) {
				if (need[i] === true) need[i] = null;
			}

			// load registers
			for (var i = 0; i < need.length; i++) {
				// nothing needed here, move along
				if (need[i] === null) continue;
				// get the object to load into the register
				var r = getSwappedRegIn(i);
				var o = (r >= opc.reg.length) ? null : opc.reg[r];

				// this is an output register
				if (mod[i] === "write") {
					var bits = (o.bits !== null) ? o.bits : that._v[o.name].bits;
					// will fit in register
					if (bits <= that.capabilities.max_arg_bits) {

						// handle the current variable loaded
						if (state.regs[i].loaded !== null && need[i] === state.regs[i].loaded) {
							var found = false;
							var needed = false;
							for (var j = 0; j < state.regs.length; j++) {
								if (j == i) continue;
								if (state.regs[j].loaded === state.regs[i].loaded) found = true;
								else if (needed === false && need[j] === state.regs[i].loaded) needed = j;
							}
							// it is needed somewhere else
							if (needed !== false && !found) vacateRegister(i);
						}
					
						// default location
						state.regs[i].where = "reg";
						continue;
					}
				}
				// this register can be an output without a loaded memory
				else if (mod[i] === "copy" && (swap[0] != swap[1])) {

					// handle the current variable loaded
					if (state.regs[i].loaded !== null && need[i] === state.regs[i].loaded) {
						var found = false;
						var needed = false;
						for (var j = 0; j < state.regs.length; j++) {
							if (j == i) continue;
							if (state.regs[j].loaded === state.regs[i].loaded) found = true;
							else if (needed === false && need[j] === state.regs[i].loaded) needed = j;
						}
						// it is needed somewhere else
						if (needed !== false && !found) vacateRegister(i);
					}

					// default location
					state.regs[i].where = "reg";
					continue;
				}

				// reference
				var cname = (o === null) ? need[i] : state.api.name(o);
				var bname = (o === null) ? cname : state.api.name(o, true);
				// find register that contains the names
				var cname_r = state.api.find(cname);
				var bname_r = state.api.find(bname);
				
				// perfect match
				if (cname_r !== null) {
					if (cname_r != i) {
						if (state.regs[i].loaded === null) {
							if (need[cname_r] !== cname) state.api.move(i, cname_r);
							else state.api.copy(i, cname_r);
						}
						else {
							loadRegister(i, cname_r);
						}
					}
				}
				// base match
				else if (bname_r !== null) {
					if (bname_r != i) {
						if (state.regs[i].loaded === null) {
							if (need[bname_r] === bname) state.api.copy(i, bname_r);
							else {
								var target_r = getSwappedRegIn(bname_r);
								var target_o = (target_r >= opc.reg.length) ? null : opc.reg[target_r];
								if (target_o !== null && state.api.name(target_o, true) === bname) state.api.copy(i, bname_r);
								else state.api.move(i, bname_r);
							}
						}
						else {
							loadRegister(i, bname_r);
						}
					}
				}
				// load register
				else {
					vacateRegister(i);
					state.api.load(i, o);
				}
				
				// see if we should copy it before casting
				if (state.regs[i].loaded !== cname) {
					var found = false;
					var needed = false;
					for (var j = 0; j < state.regs.length; j++) {
						if (j == i) continue;
						if (state.regs[j].loaded === state.regs[i].loaded) found = true;
						else if (needed === false && need[j] === state.regs[i].loaded) needed = j;
					}
					if (needed !== false && !found) {
						vacateRegister(needed);
						state.api.copy(needed, i);
					}
				}
				
				// casting needed for this variable
				if (state.regs[i].loaded !== cname || mod[i] === "write") {

					// shortcut
					var reg = state.regs[i];

					// get a list of triggers for this variable
					var triggers = state.api.getTriggers(o.name);

					// orginal and new length
					var v = that._v[o.name];
					var bits = v.bits;
					var new_bits = (o.bits !== null) ? o.bits : bits;
					
					// cast it without ram
					if (new_bits <= that.capabilities.max_arg_bits) {
						if (bits != new_bits) {
							state.api.cast(i, o);
						}
					}
					// handle pointer registers
					else {
						// reasons to cast
						var in_ram = (reg.where === "ram" || reg.where === "temp");
						if ((!in_ram && (o.invert || mod[i] === "write")) || bits != new_bits || (triggers.length > 0 && reg.where === "ram")) {
							state.api.cast(i, o);
						}
					}
					
					// invert
					if (o.invert) state.api.invert(i);
					
					// now it is loaded
					state.regs[i].loaded = cname;
				}
			}

			// compile instruction
			logAddressPre = state.api.getAddress();
			if ('compile' in base) base.compile(state, opc.call, opc.reg, opc.arg, {
				swap: swap
			});
			if (opc.invert !== null) {
				// remap the register
				var r = getSwappedRegOutInv(opc.invert);
				var o = opc.reg[opc.invert];
				var triggers = state.api.getTriggers(o.name);
				var reg = state.regs[r];
				var bits = (o.bits !== null) ? o.bits : that._v[o.name].bits;
				var do_invert = true;
				// check if output needs to be casted to temp
				if (bits > that.capabilities.max_arg_bits) {
					var in_ram = (reg.where === "ram" || reg.where === "temp");
					// cast register that needs to be triggered
					if (triggers.length > 0 && reg.where === "ram") state.api.cast(r, o);
					// this will cause the register to be saved (.loaded will be restored further down)
					else if (!in_ram) {
						reg['object'] = o;
						reg.changed = true;
						// only invert if the register was saved while freeing
						do_invert = state.api.free(r);
						if (do_invert) reg.where = "ram";
					}
				}
				// invert
				if (do_invert) state.api.invert(r);
			}
			logAddressOpc = state.api.getAddress();
			
			// quick check for priv instruction
			if (logAddressPre != logAddressOpc && (that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.PROGRAMS][logAddressPre] & 0xc0) == 0x40)
				object.sub_type = 0x01;

			// update register status
			for (var i = 0; i < state.regs.length; i++) {
				var reg = state.regs[i];
				if (after[i] === true) reg.loaded = need[i];
				else reg.loaded = after[i];
				// set register object
				if (reg.loaded !== null) {
					var r = getSwappedRegOut(i);
					var o = (r >= opc.reg.length) ? null : opc.reg[r];
					if (o !== null) reg['object'] = o;
					if (mod[i] === "write" || mod[i] === "copy") {
						reg.rev = rev++;
						reg.changed = true;
					}
				}
			}

			// log how the registers look now
			logRegistersAfter = registersToString("#     ");
			
			// remove or save things we don't need any more
			state.api.clean();
			logAddressPost = state.api.getAddress();

			// build log string
			var log = "################################################################################\n";
			log += logFunctionCall;
			log += "#\n";
			log += "#   Registers before call:\n";
			log += logRegistersBefore;
			log += "#\n";
			log += codeToString("#   ", logAddressStart, logAddressPre);
			log += "#\n";
			log += codeToString("#   ", logAddressPre, logAddressOpc);
			log += "#\n";
			log += "#   Registers after call:\n";
			log += logRegistersAfter;
			log += "#\n";
			log += codeToString("#   ", logAddressOpc, logAddressPost);
			log += "#\n";
			console.log(log);
		}
		
		// end program
		state.api.push(0xff);
		
		// update temporary usage
		if (temporaryUsed > that._compiler.temporary) that._compiler.temporary = temporaryUsed;
	};

	// create default chunks
	that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.HEADER] = [];
	that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.BOOT_CONFIG] = [];
	that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.MODULE_CONFIGS] = [];
	that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.CONSTANTS] = [];
	that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.TRIGGER_LUT] = [];
	that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.TRIGGER_LIST] = [];
	that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.PROGRAM_LUT] = [];
	that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.PROGRAMS] = [];
	that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.TIMERS] = [];

	// compiler stats
	var stats = {
		chunks: 0,
		triggers: 0,
		tasks: 0,
		timers: 0,
		mutexes: 0,
		ram: {
			total: 0,
			variables: 0,
			temporary: 0,
			timers: 0,
			mutexes: 0,
			system: 0
		},
		rom: {
			total: 0,
			constants: 0,
			configuration: 0,
			tasks: 0,
			system: 0
		}
	};

	// generate constants
	genConstants();
	stats.rom.constants = that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.CONSTANTS].length;
	
	// generate triggers
	var triggerList;
	triggerList = genAssignTriggers();
	stats.triggers = triggerList.length;
	that._compiler.reserved += stats.triggers * that.capabilities.ram_trigger_size;
	stats.ram.system += stats.triggers * that.capabilities.ram_trigger_size;

	// generate objects
	for (var prop in this.objects) {
		if (!this.objects.hasOwnProperty(prop)) continue;
		var object = this.objects[prop];
		if ('generate' in object) {
			try {
				object.generate();
			}
			catch (e) {
				throw (e);
			}
		}
	}
	
	// generate configurations
	for (var sub in this._s) {
		if (!this._s.hasOwnProperty(sub)) continue;
		var object = this._s[sub];
		if ('base' in object && 'conf' in object) {
			var base = this.objects[object.base];
			if ('generateConfig' in base) {
				base.generateConfig(sub, object);
			}
		}
	}

	// timer stats
	stats.timers = that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.TIMERS].length;
	stats.ram.timers += stats.timers * that.capabilities.ram_timer_size;
	that._compiler.reserved += stats.ram.timers;

	// compile subs
	var sub_id = 0;
	for (var sub in this._s) {
		if (!this._s.hasOwnProperty(sub)) continue;
		var object = this._s[sub];
		if ('code' in object && (!('status' in object) || object.status !== "skip")) {
			genCompile(object);
			object['id'] = sub_id++;
			// add program LUT entry
			that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.PROGRAM_LUT].push(object.sub_type);
			that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.PROGRAM_LUT].push(object.address >> 8);
			that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.PROGRAM_LUT].push(object.address & 0xff);
		}
	}
	stats.tasks = sub_id;
	stats.rom.tasks = that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.PROGRAMS].length;
	stats.ram.temporary = that._compiler.temporary;
	that._compiler.reserved += stats.tasks * that.capabilities.ram_program_size;
	stats.ram.system += stats.tasks * that.capabilities.ram_program_size;

	// generate trigger table
	for (var i = 0; i < triggerList.length; i++) {
		var t = that._t[triggerList[i]];
		if (t.target.length == 1) {
			that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.TRIGGER_LUT].push(0x80);
			that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.TRIGGER_LUT].push(that._s[t.target[0]].id);
		}
		else {
			var addr = that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.TRIGGER_LIST].length;
			that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.TRIGGER_LUT].push(addr >> 8);
			that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.TRIGGER_LUT].push(addr & 0xff);
			for (var j = 0; j < t.target.length; j++) {
				that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.TRIGGER_LIST].push(that._s[t.target[j]].id);
			}
			that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.TRIGGER_LIST].push(0xff);
		}
	}
	
	// generate mutexes
	stats.mutexes = genMutexes();
	stats.ram.mutexes = stats.mutexes * that.capabilities.ram_mutex_size;
	that._compiler.reserved += stats.ram.mutexes;

	// assign variable ram
	stats.ram.variables = allocateVariables(that._compiler.reserved + that._compiler.temporary);
	
	// resolve symbols
	resolveMemory(that._compiler.reserved);
	genConfiguration();
	resolveMemory(that._compiler.reserved, true);

	// update configuration usage
	stats.rom.configuration = that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.BOOT_CONFIG].length;
	stats.rom.configuration += that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.MODULE_CONFIGS].length;

	// update ram usage
	stats.ram.total = stats.ram.variables + stats.ram.temporary + stats.ram.timers + stats.ram.mutexes + stats.ram.system;

	// add header
	var header = that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.HEADER];
	// magic
	header.push(0xb6);
	header.push(0xd6);
	header.push(0x34);
	header.push(0x7c);
	// version
	header.push(0x01);
	// project id
	for (var i = 0; i < 16; i++) header.push(project[i]);
	// revision
	header.push(revision >> 24);
	header.push((revision >> 16) & 0xff);
	header.push((revision >> 8) & 0xff);
	header.push(revision & 0xff);

	// rom size
	for (var key in that._compiler.chunks) {
		if (!that._compiler.chunks.hasOwnProperty(key)) continue;
		var chunk = that._compiler.chunks[key];
		if (chunk.length > 0) {
			stats.chunks++;
			stats.rom.total += 3; // chunk header
			stats.rom.total += chunk.length;
		}
	}
	stats.rom.system = stats.rom.total - (stats.rom.constants + stats.rom.configuration + stats.rom.tasks);

	// convert to binary
	var toBin = function (id, chunk) {
		var ret = "";
		if (chunk.length > 0) {
			ret += String.fromCharCode(id);
			ret += String.fromCharCode(chunk.length >> 8);
			ret += String.fromCharCode(chunk.length & 0xff);
			for (var i = 0; i < chunk.length; i++) {
				if (typeof chunk[i] === "number") ret += String.fromCharCode(chunk[i] & 0xff);
			}
		}
		return ret;
	};
	var raw = toBin(DeviceRadio.Compiler.ChunkEnum.HEADER, that._compiler.chunks[DeviceRadio.Compiler.ChunkEnum.HEADER]);
	for (var key in that._compiler.chunks) {
		if (!that._compiler.chunks.hasOwnProperty(key) || key == DeviceRadio.Compiler.ChunkEnum.HEADER) continue;
		raw += toBin(key, that._compiler.chunks[key]);
	}

	// done
	this.error = false;
	return [stats, raw];
};