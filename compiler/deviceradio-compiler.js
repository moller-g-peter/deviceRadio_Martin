DeviceRadio.Compiler = function (version, hw) {
	// handle version to use
	var ver = (version !== undefined) ? parseFloat(version) : 0;
	if (isNaN(ver) || ver < 0) ver = 0;
	this.version = ver;
	this.hw = (typeof hw === "string") ? hw : "deviceradio";
	
	// setup basic capabilities
	this.capabilities = {
		registers: 5,
		max_io: 8,
		max_bits: 128,
		max_arg_bits: 16,
		max_triggers: 255,
		max_timers: 255,
		max_subs: 255,
		max_mutexes: 63,
		ram_trigger_size: 1,
		ram_program_size: 1,
		ram_timer_size: 11,
		ram_mutex_size: 1
	};
	
	// reset state
	this.reset();
};

// compiler exception
DeviceRadio.Compiler.CompilerException = function(message, token)
{
	this.message = (typeof message === "string") ? message : "Unknown error";
	this.token = (token !== undefined) ? token : null;

	if (token !== null && token !== undefined) {
		this.lineNumber = token.row;
		this.columnNumber = token.col;
		this.fileName = "Source";
	}

    if ("captureStackTrace" in Error)
        Error.captureStackTrace(this, DeviceRadio.Compiler.CompilerException);
    else
        this.stack = (new Error()).stack;
};
DeviceRadio.Compiler.CompilerException.prototype = Object.create(Error.prototype);
DeviceRadio.Compiler.CompilerException.prototype.name = "CompilerException";
DeviceRadio.Compiler.CompilerException.prototype.toString = function() {
	return this.name;
};

// enum of the different chunks
DeviceRadio.Compiler.ChunkEnum = {
	HEADER:				0x00,
	BOOT_CONFIG:		0x01,
	MODULE_CONFIGS:		0x02,
	CONSTANTS:			0x03,
	TRIGGER_LUT:		0x04,
	TRIGGER_LIST:		0x05,
	PROGRAM_LUT:		0x06,
	PROGRAMS:			0x07,
	TIMERS:				0x08,
	MUTEX_LUT:			0x09,
	MUTEX_LIST:			0x0A,
	END:				0xff
};

// interface for adding functionallity
DeviceRadio.Compiler.prototype.objects = {};

// reset the compiler
DeviceRadio.Compiler.prototype.reset = function () {
	// main error flag
	this.error = false;
	
	// optimizer flag
	this.optimized = false;

	// holds all variables
	this._v = {
	};
	
	// holds all triggers
	this._t = {
	};
	
	// holds all symbols
	this._s = {
	};
	
	// holds all namespaces
	this._ns = {
	};
	
	// holds all constants
	this._c = {
	};
	
	// holds all mutexes
	this._m = {
	};
	
	// io manager
	this.io = null;
	
	// trigger to use on reset
	this.reset = null;
	
	// compiler state
	this._compiler = {
		reserved: 0, // bytes of ram reserved
		temporary: 0, // bytes needed for temporary variables
		symbols: [],
		chunks: {}
	};
	
	// setup objects
	for (var prop in this.objects) {
		if (this.objects.hasOwnProperty(prop)) {
			var object = this.objects[prop];
			object.that = this;
			if ('setup' in object) object.setup();
			if (!('validate' in object)) object['validate'] = function(){};
			if (!('template' in object)) object['template'] = {};
			if (!('props' in object.template)) object.template['props'] = [];
			if (!('require' in object.template)) object.template['require'] = [];
			if (!('calls' in object.template)) object.template['calls'] = {};
		}
	}
};

// create a new trigger and return the name
DeviceRadio.Compiler.prototype.createTrigger = function (trigger) {
	// create a random trigger if not provided with a name
	if (typeof trigger !== "string") trigger = DeviceRadio.util.uuid();
	
	// create trigger
	if (!(trigger in this._t)) {
		this._t[trigger] = {
			source: [],
			target: []
		};
	}
	
	return trigger;
};

// create a new constant and return the name
DeviceRadio.Compiler.prototype.createConst = function (bits, value, variable) {
	if (bits == 1 && variable !== true) return null; // handled by opcodes
	if (Object.prototype.toString.call( value ) !== '[object Array]' || value.length == 0) value = [0];

	// handle arrays
	var array = 1;
	if (Object.prototype.toString.call( value[0] ) === '[object Array]') {
		array = value.length;
		// aligned array
		if (bits > this.capabilities.max_arg_bits || !(bits & 7)) {
			var block = [];
			var bytes = (bits & 7) ? (bits >> 3) + 1 : bits >> 3;
			for (var i = 0; i < value.length; i++) {
				var val = value[i];
				while (val.length < bytes) val.push(0x00);
				block = block.concat(val);
			}
			value = block;
		}
		// pack values
		else {
			var block = [];
			var align = 0;
			for (var i = 0; i < value.length; i++) {
				var val1 = value[i][0];
				var val2 = (value[i].length > 1) ? value[i][1] : null;
				if (bits > 8 && val2 === null) val2 = 0;
				if (!align) {
					block.push(val1);
					if (val2 !== null) block.push(val2);
				}
				else {
					var alignPush = function (val, bits) {
						block[block.length - 1] |= (val << align) & 0xff;
						if (bits > (8 - align)) block.push(val >> (8 - align));
					};
					if (val2 === null) {
						alignPush(val1, bits);
					}
					else {
						alignPush(val1, 8);
						alignPush(val2, bits - 8);
					}
				}
				// update alignment
				align = (align + bits) & 7;
			}
			value = block;
		}
	}

	// create entry
	var key = DeviceRadio.util.uuid();
	this._c[key] = {
		bits: bits,
		array: array,
		value: value
	};
	
	return key;
};

// log variable read
DeviceRadio.Compiler.prototype.logVariableR = function (sub, name) {
	if (name in this._v) {
		this._v[name].read.push(sub);
		if (this._v[name].write.indexOf(sub) < 0) this._v[name].depend.push(sub);
	}
};

// log variable write
DeviceRadio.Compiler.prototype.logVariableW = function (sub, name) {
	if (name in this._v) {
		this._v[name].write.push(sub);
	}
};

// align the bit size of a token
DeviceRadio.Compiler.prototype.alignToken = function (token, bits) {
	if (bits === undefined) bits = 8;
	if (token.type == "INTEGER") {
		var b = (token.hint_bits >= token.bits) ? token.hint_bits : token.bits;
		while (b < bits || (b % bits)) b++;
		token.bits = b;
	}
	else if (token.type == "VARIABLE" && token.bits === null) {
		var b = this._v[token.name].bits;
		var o = b;
		while (b < bits || (b % bits)) b++;
		if (b > o) token.bits = b;
		else return b;
	}
	return token.bits;
};

// add tokens to the compiler
DeviceRadio.Compiler.prototype.add = function (tokens, namespace, title) {
	if (this.error) throw new DeviceRadio.Compiler.CompilerException("Compiler is in an error state");
	if (this.optimized) throw new DeviceRadio.Compiler.CompilerException("Code can't be added after optimizer is called");
	if (Object.prototype.toString.call( tokens ) !== '[object Array]') {
		throw new DeviceRadio.Compiler.CompilerException("Compiler.add(): tokens must be an array.");
	}
	this.error = true;
	
	// setup namespace
	if (typeof namespace !== "string") namespace = DeviceRadio.util.uuid();
	if (typeof title !== "string") title = "Unknown";
	if (namespace in this._ns) {
		throw new Error("Compiler.add(): Namespace for '" + title + "' already defined.");
	}
	this._ns[namespace] = {
		title: title
	};
	this.namespace = namespace;
	
	// local this
	var that = this;
	
	// build and throw an error message
	var err = function(msg, token) {
		if (typeof msg !== "string") msg = "Unknown error";
		msg += " in '" + title + "'";
		if (token !== undefined) {
			msg += " on line " + token.row + ", column " + token.col;
		}
		msg += ".";
		//throw new Error(msg);
		throw new DeviceRadio.Compiler.CompilerException(msg, token);
	};
	
	// helper to scan for unexpected !
	var noInvert = function(row) {
		for (var j = 0; j < row.length; j++) {
			if ('invert' in row[j] && row[j].invert) err("Unexpected symbol '!'", row[j]);
		}
	};
	
	// setup reference to variable
	var addAtVariable = function(row, ctx) {
		var offset = 0;

		// error checking
		if (row.length < 2) err("Missing symbol for 'at' operation", row[0]);
		if (row[0].type != "KEYWORD" || row[0].value != "at") err("Expecting 'at'", row[0]);
		if (row[1].type != "VARIABLE") err("Expecting variable name", row[1]);
		if (row.length == 4) {
			if (row[2].type != "KEYWORD" || row[2].value != "+") err("Expecting '+'", row[2]);
			if (row[3].type != "INTEGER") err("Expecting an offset", row[3]);
			if (row[3].bits > 16) offset = 65536;
			else if (row[3].bits > 8) offset = row[3].value[0] + row[3].value[1] * 256;
			else offset = row[3].value[0];
		}
		else if (row.length > 2) err("Unexpected symbol", row[2]);

		var t = row[1];
		if (t.bits !== null) err("Bit size not allowed here", t);

		// build name and find reference
		var name = null;
		if (t.ns !== null) {
			name = t.ns + "::" + t.value;
		}
		else if (ctx !== undefined) {
			name = ctx.ns + "::" + t.value;
			if (!(name in that._v)) name = null;
		}
		if (name === null) name = namespace + "::" + t.value;
		if (!(name in that._v)) err("Referenced variable not found", t);
		var entry = that._v[name];

		// handle index
		if (t.index !== null) {
			if (entry.array === null) err("Referenced variable is not an array", t);
			else if (t.index >= entry.array) err("Referenced index is outside of array", t);
			else {
				var bits = entry.bits;
				// align to byte
				if (bits > that.capabilities.max_arg_bits) {
					if (bits & 7) bits = ((bits >> 3) + 1) << 3;
				}
				offset += t.index * bits;
			}
		}

		// create a context
		return {
			id: "var",
			bits: entry.bits,
			array: entry.array,
			size: entry.size,
			offset: offset,
			ns: (ctx !== undefined) ? ctx.ns : namespace,
			name: name
		};
	};
	
	// parse and add a variable
	var addVariable = function(row, ctx) {
		var ret = {
			id: "var",
			bits: null,
			array: null,
			size: null,
			offset: 0,
			expecting: false // expecting a value
		};
		if (ctx === undefined) {
			ret['ns'] = namespace;
		}
		else {
			ret['ns'] = ctx.ns;
		}
		
		// hold value
		var val = null;
		var nvm = false;
		var nested = (ctx !== undefined && ctx.id === "var");
		
		// only var keyword in nested
		var s = (nested) ? 1 : 0;
		
		// use a state machine to parse
		for (var i = 0; i < row.length; i++) {
			var t = row[i];
			switch (s) {
			// expexting dim
			case 0:
				if (t.type == "KEYWORD" && t.value == "var") s++;
				else err("Expecting 'var'", t);
				break;
			// expecting variable
			case 1:
				if (t.type == "VARIABLE") {
					if (t.ns !== null) err("Variable can't be defined outside its own namespace", t);
					if (t.bits !== null) ret.bits = t.bits;
					if (t.index !== null) ret.array = t.index;
					var name = ret.ns + '::' + t.value;
					if (name in that._v) err("Variable name already defined", t);
					ret['name'] = name;
					s++;
				}
				else if (t.type == "KEYWORD" && t.value == "nvm") {
					if (ctx === undefined || ctx.id == "task") nvm = true;
					else err("Non volatile variable definition not allowed here", t);
				}
				else err("Expecting variable name", t);
				break;
			// expecting =
			case 2:
				if (t.type == "KEYWORD" && t.value == "=") s++;
				else err("Expecting '='", t);
				if (nested) err("Default values are not allowed on nested variables", t);
				break;
			// expecting value
			case 3:
				if (t.type == "ARRAY") {
					if (ret.array !== null) {
						if (t.value.length <= ret.array) {
							var max = 0;
							val = [];
							for (var j = 0; j < t.value.length; j++) {
								if (t.value[j].type == "INTEGER") {
									if (t.value[j].bits > max) max = t.value[j].bits;
									val.push(t.value[j].value);
								}
								else err("Expecting value", t.value[j]);
							}
							if (ret.bits === null) ret.bits = max;
							else if (max > ret.bits) err("Values does not fit in variable", t);
						}
						else err("Values does not fit in array", t);
					}
					else err("Variable is not an array", t);
					s++;
				}
				else if (t.type == "INTEGER") {
					if (ret.bits === null) {
						ret.bits = t.hint_bits;
					}
					else if (t.bits > ret.bits) err("Values does not fit in variable", t);
					if (ret.array !== null) val = [t.value];
					else val = t.value;
					s++;
				}
				else err("Expecting value", t);
				break;
			// not expected
			default:
				if (t.type == "KEYWORD" && t.value == ",") ret.expecting = true;
				else err("Unexpected symbol", t);
				break;
			}
		}
		// open =
		if (s == 3) {
			ret.expecting = true;
		}
		else if (s != 2 && s != 4) err("Invalid 'var' syntax", row[0]);

		// set missing
		if (ret.bits === null) ret.bits = 1;
		if (ret.array !== null) {
			if (ret.bits <= that.capabilities.max_arg_bits) ret.size = ret.bits * ret.array;
			// round to nearest byte
			else {
				ret.size = ret.bits;
				if (ret.size & 7) {
					ret.size = ((ret.size >> 3) + 1) << 3;
				}
				ret.size *= ret.array;
			}
		}
		else {
			ret.size = ret.bits;
			if (ret.size > that.capabilities.max_arg_bits) {
				if (ret.size & 7) ret.size = ((ret.size >> 3) + 1) << 3;
			}
		}

		// check limits
		if (ret.size < 1) err("Variable must have a size", row[0]);
		else if (ret.bits > that.capabilities.max_bits) err("Maximum variable size is " + that.capabilities.max_bits + " bits", row[0]);
		
		// setup variable entry
		var entry = {
			bits: ret.bits,			// size in bits of variable
			size: ret.size,			// size in bits for whole variable, including array and alignment
			array: ret.array,		// size of array or null
			value: val,				// value or array of values (depending on .array)
			read: [],				// what sub programs read the variable
			write: [],				// what sub programs write to the variable
			depend: [],				// what sub programs depend on the variable value
			children: [],			// variables that has this as their parent
			trigger: null,			// trigger used to monitor changes,
			nvm: nvm				// true if non volatile variable
		};
		
		// add dependencies if non volatile
		if (nvm) {
			entry.read.push("nvm");
			entry.write.push("nvm");
			entry.depend.push("nvm");
		}
		
		// if at another variable, make sure it fits
		if (ctx !== undefined && ctx.id == 'var') {
			if (ctx.offset + ret.size > ctx.size) err("Nested variable does not fit parent variable", row[0]);
			if ((ctx.offset & 7) && ret.size >= that.capabilities.max_arg_bits) err("Variables of " + that.capabilities.max_arg_bits + " and larger must be 8-bit aligned", row[0]);
			entry['parent'] = ctx.name;
			entry['offset'] = ctx.offset;
			ctx.offset += ret.size;
			// add child to parent
			that._v[ctx.name].children.push(ret['name']);
		}

		// add variable
		that._v[ret['name']] = entry;

		return ret;
	};

	// parse and add a variable
	var addVariableConst = function(row, ctx) {
		// parse the row
		var comma_l = false;
		var comma_r = false;
		var val = null;
		if (row.length == 1) {
			if (row[0].type == "KEYWORD" && row[0].value == ",") comma_l = true;
			else val = row[0];
		}
		else if (row.length == 2) {
			if (row[0].type == "KEYWORD" && row[0].value == ",") {
				comma_l = true;
				val = row[1];
			}
			else {
				val = row[0];
				if (row[1].type == "KEYWORD" && row[1].value == ",") comma_r = true;
				else err("Expected a comma", row[1]);
			}
		}
		else if (row.length == 3) {
			if (row[0].type == "KEYWORD" && row[0].value == ",") comma_l = true;
			else err("Expected a comma", row[0]);
			val = row[1];
			if (row[2].type == "KEYWORD" && row[2].value == ",") comma_r = true;
			else err("Expected a comma", row[2]);
		}
		else err("Unexpected symbols in the default variable values", row[row.length - 1]);
		if (ctx.expecting && comma_l) err("Unexpected comma", row[0]);
		else if (!ctx.expecting && !comma_l) err("Expected a comma", row[0]);

		// handle value
		var max_bits = 0;
		var value = [];
		if (val !== null) {
			if (val.type == "ARRAY") {
				for (var i = 0; i < val.value.length; i++) {
					var t = val.value[i];
					if (t.type == "INTEGER") {
						if (t.bits > max_bits) max_bits = t.bits;
						value.push(t.value);
					}
					else err("Expected value", t);
				}
			}
			else if (val.type == "INTEGER") {
				max_bits = val.bits;
				value.push(val.value);
			}
			else err("Expected value", val);
		}
		if (value.length > 0) {
			var v = that._v[ctx.name];
			if (max_bits > ctx.bits) err("Value does not fit in variable", val);
			if ('array' in v && v.array !== null) {
				if (v.value !== null) value = v.value.concat(value);
				if (value.length > v.array) err("Values does not fit in array", val);
				v.value = value;
			}
			else {
				if (v.value !== null || value.length != 1) err("Variable is not an array", row[0]);
				v.value = value[0];
			}
		}

		// update the expection
		ctx.expecting = (comma_r || (comma_l && val === null));
	};

	// add a sub program
	var addSub = function(row) {
		// start conditions
		var conditions = [];
		
		// error checking
		if (row.length < 2) err("Missing symbol for 'task' definition", row[0]);
		if (row.length > 4) err("Unexpected symbol", row[4]);
		if (row[0].type != "KEYWORD" || row[0].value != "task") err("Expecting 'task'", row[0]);
		if (row[1].type != "SYMBOL") err("Expecting symbol name", row[1]);
		if (row[1].ns !== null) err("Sybol name must use default namespace", row[1]);
		if (row.length > 2) {
			if (row[2].type != "KEYWORD" || row[2].value != "on") err("Expecting 'on'", row[2]);
			if (row.length == 3) err("Missing start conditions", row[2]);
			if (row[3].type == "ARRAY") {
				conditions = row[3].value;
			}
			else conditions = [row[3]];
		}

		// make sure it doesn't exist
		var name = namespace + "::" + row[1].value;
		if (name in that._s) err("Symbol name already exist", row[1]);
		
		// process conditions
		for (var j = 0; j < conditions.length; j++) {
			var t = conditions[j];
			if (t.type == "VARIABLE") {
				var variable = (t.ns !== null) ? t.ns : namespace;
				variable += "::" + t.value;
				// make sure it exists
				if (!(variable in that._v)) err("Variable '" + t.value + "' does not exist", t);
				// no index
				if (t.index !== null) err("Indexed variables are not supported as triggers", t);
				// create trigger if missing
				if (that._v[variable].trigger === null) that._v[variable].trigger = that.createTrigger();
				that._t[that._v[variable].trigger].target.push(name);
			}
			else if (t.type == "TRIGGER") {
				try {
					that.assert(t, {
						create: "local"
					});
				}
				catch (e) {
					if (e.toString() === "CompilerException") err(e.message, e.token);
					else err(e.toString());
				}
				that._t[((t.ns !== null) ? t.ns : that.namespace) + "::" + t.value].target.push(name);
			}
			else if (t.type == "SYMBOL") {
				var symbol = t.value;
				if (t.ns !== null) symbol = t.ns + "::" + t.value;
				else if (that.namespace + "::" + t.value in that._s) symbol = that.namespace + "::" + t.value;
				if (!(symbol in that._s)) err("Object '" + t.value + "' does not exist", t);
				if (!("trigger" in that._s[symbol])) err("Object '" + t.value + "' does not emit a trigger and can't be used as a start condition", t);
				that._t[that._s[symbol].trigger].target.push(name);
			}
			else if (t.type == "INTEGER" && 'timer' in that.objects) {
				that._t[that.objects.timer.createIntervalTimer(t)].target.push(name);
			}
			else err("Invalid start condition", t);
		}

		// create a namespace
		var ns = DeviceRadio.util.uuid();
		that._ns[ns] = {
			title: title + ':' + row[1].value
		}
		that.namespace = ns;
		
		// create a trigger
		var trigger = that.createTrigger();
		that._t[trigger].target.push(name);
		
		// symbol entry
		var entry = {
			trigger: trigger,
			code: []
		};
		that._s[name] = entry;
		
		return {
			id: "task",
			ns: ns,
			name: name
		};
	};
	
	// configure
	var addConf = function(row) {
		if (row.length < 2) err("Missing symbol for 'conf' definition", row[0]);
		if (row.length > 4) err("Unexpected symbol", row[4]);
		if (row[0].type != "KEYWORD" || row[0].value != "conf") err("Expecting 'conf'", row[0]);
		if (row[1].type != "SYMBOL") err("Expecting object name", row[1]);
		if (row.length > 2) {
			if (row[2].type != "KEYWORD" || row[2].value != "as") err("Expecting 'as'", row[2]);
			if (row.length == 3) err("Missing object instance name", row[2]);
			if (row[3].type != "SYMBOL") err("Expecting object instance name", row[3]);
		}
		var name = (row[1].ns !== null) ? row[1].ns + "::" + row[1].value : row[1].value;
		if (!(name in that._s)) err("Object '" + name + "' does not exist", row[1]);
		var ret = {
			id: 'conf',
			token: row[0]
		};
		if (row.length == 4) {
			if (row[3].ns !== null) err("Object instance name must be in default namespace", row[3]);
			var copy = namespace + "::" + row[3].value;
			if (copy in that._s) err("Instance '" + copy + "' already not exists", row[3]);
			if (!('template' in that._s[name]) || !that._s[name].template) err("Object can not be instantiated", row[1]);
			// create instance
			that._s[copy] = {
				base: that._s[name].base,
				conf: {}
			};
			ret['target'] = copy;
		}
		else {
			if (('template' in that._s[name]) && that._s[name].template) err("Object must be instantiated", row[1]);
			if (!('conf' in that._s[name])) that._s[name]['conf'] = {};
			ret['target'] = name;
		}
		return ret;
	};
	
	// add configuration property
	var addConfProp = function(row, ctx) {
		if (row.length < 3) err("Missing symbol for 'conf' property", row[0]);
		if (row.length > 3) err("Unexpected symbol", row[3]);
		if (row[0].type != "SYMBOL" || row[0].ns != null) err("Expecting property", row[0]);
		if (row[1].type != "KEYWORD" || row[1].value != "=") err("Expecting '='", row[1]);
		if (row[0].value in that._s[ctx.target].conf) err("Property '" + row[0].value + "' alread set", row[0]);
		if (that.objects[that._s[ctx.target].base].template.props.indexOf(row[0].value) < 0) err("Unknown property '" + row[0].value + "'", row[0]);
		that._s[ctx.target].conf[row[0].value] = row[2];
	};
	
	// add a math section
	var addMath = function(row, ctx) {
		return {
			id: "math"
		};
	};
	
	// process each line of code
	var addCode = function(row, ctx) {
		var output = null;
		var input = null;
		var operator = null;
		var operator_invert = null;

		// build a simplified string of the row to match against
		var pattern = "";
		for (var i = 0; i < row.length; i++) {
			if (row[i].type == "KEYWORD") {
				if (row[i].value.length == 1) pattern += row[i].value;
				else pattern += "?";
			}
			else if (row[i].type == "SYMBOL") pattern += "S";
			else pattern += "X";
		}
		switch (pattern) {
		case "S":
		case "S()":
			operator = row[0];
			break;
		case "S(X)":
		case "S(S)":
			operator = row[0];
			input = row[2];
			break;
		case "X=X":
			output = row[0];
			input = row[2];
			break;
		case "X=S":
		case "X=S()":
			output = row[0];
			operator = row[2];
			break;
		case "X=S(X)":
		case "X=S(S)":
			output = row[0];
			operator = row[2];
			input = row[4];
			break;
		case "S=X":
		case "S=S":
			operator = row[0];
			input = row[2];
			break;
		default:
			console.log(pattern);
			err("Invalid statement", row[0]);
		}

		// no invert on output and must be a variable
		if (output !== null) {
			if (output.type !== "VARIABLE") err("Statement output must be a variable", output);
			if (output.invert) err("Unexpected symbol '!'", output);
			if (output.bits !== null) err("Casting of bit size isn't possible on the output variable", output);
		}
		
		// no invert on operator without output
		if (output === null && operator !== null && operator.invert) err("Unexpected symbol '!'", operator);
		
		// sanitize input arguments
		if (input !== null) {
			input = (input.type === "ARRAY") ? input.value : [input];
		}
		else input = [];
		
		// handle operator
		var opc = null;
		var call = null;
		var conf = null;
		if (operator !== null) {
			opc = ((operator.ns !== null) ? operator.ns : namespace) + "::" + operator.value;
			if (!(opc in that._s)) {
				if (operator.ns !== null) err("Operator not found", operator);
				opc = operator.value;
			}
			if (opc in that._s) {
				if ('template' in that._s[opc] && that._s[opc].template) err("The operator is not callable", operator);
				if ('conf' in that._s[opc]) conf = opc;
				if ('base' in that._s[opc]) opc = that._s[opc].base;
			}
			if ('call' in operator) call = operator.call;
			// setup invert
			if (operator.invert) operator_invert = true;
		}
		else {
			opc = "copy";
			// optimize inverted argument, do it on the result
			if ('invert' in input[0] && input[0].invert) {
				input[0].invert = false;
				operator_invert = true;
			}
		}
		if (!(opc in that.objects)) err("Operator '" + opc + "' does not exist", operator);
		if (call === null) {
			if (output === null) call = ('set' in that.objects[opc].template) ? that.objects[opc].template.set : "";
			else call = ('get' in that.objects[opc].template) ? that.objects[opc].template.get : "";
		}
		if (!(call in that.objects[opc].template.calls) || call.charAt(0) == '_') err("Operator call" + ((call == "") ? "" : " '" + call + "'") + " is not supported", operator);

		// find alternative calls
		var base = that.objects[opc].template.calls[call];
		if ('alt' in base) {
			// create a list of alternatives
			var alt = (Object.prototype.toString.call( base.alt ) !== '[object Array]') ? [base.alt] : base.alt;
			alt.push(call);
			// search alternatives
			for (var i = 0; i < alt.length; i++) {
				var b = that.objects[opc].template.calls[alt[i]];
				var inputs = 0;
				var outputs = false;
				if ('reg' in b) {
					for (var j = 0; j < b.reg.length; j++) {
						if (typeof b.reg[j] === "number") {
							var _inputs = b.reg[j] + 1;
							if (_inputs > inputs) inputs = _inputs;
						}
						else if (b.reg[j] === "o") outputs = true;
					}
				}
				if ('arg' in b) {
					for (var j = 0; j < b.arg.length; j++) {
						if (typeof b.arg[j] === "number") {
							var _inputs = b.arg[j] + 1;
							if (_inputs > inputs) inputs = _inputs;
						}
						else if (b.arg[j] === "o") outputs = true;
					}
				}
				// is it a match?
				if ((input.length === inputs) && ((output !== null) === outputs)) {
					call = alt[i];
					base = that.objects[opc].template.calls[call];
					break;
				}
			}
		}

		// build register and argument stacks
		var args = [];
		var regs = [];
		var input_usage = 0; // track used inputs
		var output_usage = 0; // track used outputs
		var output_reg = null;
		if ('reg' in base) {
			for (var i = 0; i < base.reg.length; i++) {
				if (typeof base.reg[i] === "number") {
					if (base.reg[i] >= input.length) err("Missing argument in statement", row[0]);
					var val = input[base.reg[i]];
					if (val.type !== "VARIABLE" && val.type !== "INTEGER") err("Argument must be a variable or constant", val);
					regs.push(val);
					if ((base.reg[i] + 1) > input_usage) input_usage = base.reg[i] + 1;
				}
				else if (base.reg[i] === "o") {
					if (output !== null) {
						output_reg = regs.length;
						regs.push(output);
					}
					else err("An output variable is required", row[0]);
					output_usage = 1;
				}
				else if (base.reg[i] === "c") {
					if (conf !== null) regs.push(conf);
					else err("Statements requires a configurable object", row[0]);
				}
			}
		}
		if ('arg' in base) {
			for (var i = 0; i < base.arg.length; i++) {
				if (typeof base.arg[i] === "number") {
					if (base.arg[i] >= input.length) err("Missing argument in statement", row[0]);
					var val = input[base.arg[i]];
					args.push(val);
					if ((base.arg[i] + 1) > input_usage) input_usage = base.arg[i] + 1;
				}
				else if (base.arg[i] === "o") {
					if (output !== null) args.push(output);
					else err("An output variable is required", row[0]);
					output_usage = 1;
				}
				else if (base.arg[i] === "c") {
					if (conf !== null) args.push(conf);
					else err("Statements requires a configurable object", row[0]);
				}
			}
		}
		// make sure we don't have unused arguments
		if (output !== null && output_usage == 0) err("Operator does not return a value", output);
		if (input.length > input_usage) {
			if (input_usage == 0)
				err("Operator expects no arguments", row[0]);
			else
				err("Operator only expects " + input_usage + " arguments", row[0]);
		}
		
		// make sure everything exist and add correct namespaces
		var validate_argument = function(arg) {
			var name = ((arg.ns !== null) ? arg.ns + "::" : "") + arg.value;
			if (typeof arg !== "string") {
				switch (arg.type) {
				case "INTEGER":
					break;
				case "VARIABLE":
					if (arg.ns === null) {
						if ((that.namespace + "::" + arg.value) in that._v) arg.ns = that.namespace;
						else if ((namespace + "::" + arg.value) in that._v) arg.ns = namespace;
					}
					arg['name'] = arg.ns + "::" + arg.value;
					if (!(arg.name in that._v)) err("Variable '\$" + name + "' does not exist", arg);
					if (arg.index !== null) {
						if (that._v[arg.name].array === null) err("Variable '\$" + name + "' is not an array", arg);
						else if (arg.index >= that._v[arg.name].array) err("Index of '\$" + name + "' is outside of array", arg);
					}
					break;
				case "TRIGGER":
					if (arg.ns === null) {
						arg.ns = namespace;
						that.createTrigger(arg.ns + "::" + arg.value);
					}
					if (!((arg.ns + "::" + arg.value) in that._t)) err("Trigger '#" + name + "' does not exist", arg);
					arg['name'] = arg.ns + "::" + arg.value;
					break;
				case "SYMBOL":
					if (arg.ns === null) {
						if ((namespace + "::" + arg.value) in that._s) arg.ns = namespace;
					}
					arg['name'] = ((arg.ns !== null) ? arg.ns + "::" : "") + arg.value;
					if (!(arg.name in that._s)) err("Object '" + name + "' does not exist", arg);
					break;
				}
			}
		};
		for (var i = 0; i < args.length; i++) validate_argument(args[i]);
		for (var i = 0; i < regs.length; i++) validate_argument(regs[i]);

		// estimate variable usage
		for (var i = 0; i < regs.length; i++) {
			var arg = regs[i];
			if (typeof arg !== "string" && arg.type == "VARIABLE") {
				var v = that._v[arg.name];
				var write = ('mod' in base && i < base.mod.length && (base.mod[i] === "write" | base.mod[i] === "copy"));
				if (write) v.write.push(ctx.name);
				else {
					v.read.push(ctx.name);
					if (v.write.indexOf(ctx.name) < 0) v.depend.push(ctx.name);
				}
			}
		}

		// validate the arguments
		if ('analyze' in that.objects[opc]) {
			try {
				that.objects[opc].analyze(ctx.name, call, regs, args);
			}
			catch (e) {
				if (e.toString() === "CompilerException") err(e.message, e.token);
				else err(e.toString());
			}
		}
		
		// handle mutexes
		if ('mutex' in base) {
			var mutexes = base.mutex;
			if (Object.prototype.toString.call( mutexes ) !== '[object Array]') mutexes = [mutexes];
			for (var i = 0; i < mutexes.length; i++) {
				var mutex = mutexes[i];
				// create the mutex
				if (!(mutex in that._m)) {
					that._m[mutex] = {
						lock: []
					};
				}
				// add dependency
				if (that._m[mutex].lock.indexOf(ctx.name) < 0) that._m[mutex].lock.push(ctx.name);
			}
		}
		
		// create constants
		for (var i = 0; i < regs.length; i++) {
			var reg = regs[i];
			if (typeof reg !== "string" && reg.type == "INTEGER") {
				reg['const'] = that.createConst(reg.bits, reg.value);
			}
		}

		// add the code line
		that._s[ctx.name].code.push({
			arg: args,
			reg: regs,
			base: opc,
			call: call,
			row: row[0].row,
			col: row[0].col,
			ns: ctx.ns,
			invert: (operator_invert === true) ? output_reg : null // register to invert after call
		});
	};
	
	// state for the parsing
	var i = 0;
	var state = null;
	var context = [];
	
	// process the tokens
	while (i < tokens.length) {
		var t = tokens[i++];
		if (t.type == "EOL") {
		}
		else if (t.type == "INDENT") {
			if (state !== null) {
				context.push(state);
				state = null;
			}
			// unexpected
			else err("Unexpected indenting", t);
		}
		else if (t.type == "OUTDENT") {
			if (context.length > 0) {
				if ('expecting' in context[context.length - 1] && context[context.length - 1].expecting) err("Expecting default values", t);
				state = context.pop();
			}
			// unexpected
			else err("Unexpected indenting", t);
		}
		else {
			// reset state
			if (state !== null) {
				// validate configuration
				if (state.id == 'conf') {
					var require = that.objects[that._s[state.target].base].template.require;
					for (var j = 0; j < require.length; j++) {
						if (!(require[j] in that._s[state.target].conf)) err("Missing required property '" + require[j] + "'", state.token);
					}
					// validate key-value configuration
					try {
						that.objects[that._s[state.target].base].validate(state.target);
					}
					catch (e) {
						if (e.toString() === "CompilerException") err(e.message, e.token);
						else err(e.toString(), state.token);
					}
				}
				else if (state.id == 'task') {
					that.namespace = namespace;
				}
				state = null;
			}
			
			// extract one row
			var row = [t];
			do {
				var tt = tokens[i++];
				if (tt.type == "EOL") break;
				row.push(tt);
			} while (i < tokens.length);

			// global state
			if (context.length == 0) {
				
				// inverts (!) are not allowed
				noInvert(row);
				
				if (t.type == "KEYWORD") {
					switch (t.value) {
					case "var":
						state = addVariable(row);
						break;
					case "at":
						state = addAtVariable(row);
						break;
					case "conf":
						state = addConf(row);
						break;
					case "task":
						state = addSub(row);
						break;
					// unexpected
					default:
						err("Unexpected keyword '" + t.value + "'");
						break;
					}
				}
				// unexpected
				else {
					err("Unexpected symbol", t);
				}
			}
			// handle context
			else {
				var c = context[context.length - 1];
				
				// inverts (!) are only allowed in sub programs
				if (c.id != "task") noInvert(row);
				
				switch (c.id) {
				// in a variable definition
				case "var":
					//if (t.type == "KEYWORD" && t.value == "var") {
					if (t.type == "VARIABLE") {
						if (c.expecting) err("Expecting default values", row[0]);
						state = addVariable(row, c);
					}
					else addVariableConst(row, c);
					break;
				// in a configuration block
				case "conf":
					addConfProp(row, c);
					break;
				// in a sub program
				case "task":
					if (t.type == "KEYWORD" && (t.value == "var" || t.value == "at" || t.value == "math")) {
						noInvert(row);
						if (t.value == "var") state = addVariable(row, c);
						else if (t.value == "math") state = addMath(row, c);
						else state = addAtVariable(row, c);
					}
					else addCode(row, c);
					break;
				// in math section
				case "math":
					break;
				// unexpected
				default:
					err("Unexpected state", t);
					break;
				}
			}
		}
	}

	// done
	this.error = false;
};

// assertion
DeviceRadio.Compiler.prototype.assert = function (token, type, options) {
	if (type !== undefined) {
		if (typeof type !== "string") {
			options = type;
			type = token.type;
		}
	}
	else type = token.type;
	if (options === undefined) options = {};
	if (token.type !== type) throw new DeviceRadio.Compiler.CompilerException("Invalid value type", token);
	
	// helper for building error
	var getBitsText = function (bits) {
		var ret = '';
		var endix = 'bit';
		for (var i = 0; i < bits.length; i++) {
			if (ret == '') ret += bits[i];
			else if ((i + 1) >= bits.length) {
				ret += ' or ' + bits[i];
			}
			else ret += ', ' + bits[i];
			if (bits[i] != 1) endix = 'bits';
		}
		return ret + ' ' + endix;
	};
	var getListText = function (list) {
		var ret = '';
		if (list.length == 1) ret = list[0];
		else if (list.length > 1) {
			for (var i = 0; i < (list.length - 1); i++) {
				if (i > 0) ret += ", ";
				ret += "\"" + list[i] + "\"";
			}
			ret += " or \"" + list[list.length - 1] + "\"";
		}
		return ret;
	};
	
	// helper for getting integer value (max 32-bit else null)
	var getIntegerValue = function (value) {
		var ret = null;
		if (value.length <= 4) {
			ret = value[0];
			if (value.length >= 2) {
				ret += value[1] * 256;
				if (value.length >= 3) {
					ret += value[2] * 65536;
					if (value.length >= 4) ret += value[3] * 16777216;
				}
			}
		}
		return ret;
	};
	
	var name, value;
	
	// evaluate
	switch (type) {
	case "VARIABLE":
		name = (token.ns !== null) ? token.ns : this.namespace;
		name += "::" + token.value;
		if (!(name in this._v)) throw new DeviceRadio.Compiler.CompilerException("Variable '" + token.value + "' does not exist", token);
		var variable = this._v[name];
		for (var test in options) {
			if (options.hasOwnProperty(test)) {
				switch (test) {
				case 'scope':
					if (options.scope === null) {
						if (token.ns !== null) throw new DeviceRadio.Compiler.CompilerException("Variable must use default namespace", token);
					}
					else if (options.scope !== token.ns) throw new DeviceRadio.Compiler.CompilerException("Variable must have namespace '" + options.scope + "'", token);
					break;
				case 'cast':
					if (options.cast === null) {
						if (token.bits !== null) throw new DeviceRadio.Compiler.CompilerException("Changing bit size isn't allowed here", token);
					}
					break;
				case 'bits':
					if (Object.prototype.toString.call( options.bits ) === '[object Array]') {
						if (options.bits.indexOf(variable.bits) < 0) {
							throw new DeviceRadio.Compiler.CompilerException("Size of variable must be " + getBitsText(options.bits), token);
						}
					}
					else if (variable.bits !== options.bits) {
						if (options.bits == 1)
							throw new DeviceRadio.Compiler.CompilerException("Variable must be boolean", token);
						else
							throw new DeviceRadio.Compiler.CompilerException("Variable must be " + options.bits + " bit" + ((options.bits != 1) ? "s" : ""), token);
					}
					break;
				case 'max_size':
					if (variable.size > options.max_size)
						throw new DeviceRadio.Compiler.CompilerException("Variable must not be greater than " + options.max_bits + " bit" + ((options.max_bits != 1) ? "s" : ""), token);
					break;
				case 'array':
					if (options.array === null) {
						if (token.index !== null) throw new DeviceRadio.Compiler.CompilerException("Variable must not have an array index", token);
					}
					break;
				case 'nested':
					if (options.nested === false) {
						if ('parent' in variable && variable.parent !== null) throw new DeviceRadio.Compiler.CompilerException("Nested variable not supported", token);
					}
					break;
				default:
					throw new DeviceRadio.Compiler.CompilerException("Invalid assertion", token);
				}
			}
		}
		break;
	case "SYMBOL":
		for (var test in options) {
			if (options.hasOwnProperty(test)) {
				switch (test) {
				case 'values':
					if (options.values.indexOf(token.value.toLowerCase()) < 0)
						throw new DeviceRadio.Compiler.CompilerException("Accepted values are " + getListText(options.values), token);
					break;
				}
			}
		}
		break;
	case "INTEGER":
		for (var test in options) {
			if (options.hasOwnProperty(test)) {
				switch (test) {
				case 'max':
					value = getIntegerValue(token.value);
					if (value === null || value > options.max)
						throw new DeviceRadio.Compiler.CompilerException("Largest value allowed is " + options.max, token);
					break;
				case 'min':
					value = getIntegerValue(token.value);
					if (value !== null && value < options.min)
						throw new DeviceRadio.Compiler.CompilerException("Smallest value allowed is " + options.min, token);
					break;
				case 'max_bits':
					if (token.bits > options.max_bits)
						throw new DeviceRadio.Compiler.CompilerException("Value must not be greater than " + options.max_bits + " bit" + ((options.max_bits != 1) ? "s" : ""), token);
					break;
				case 'values':
					value = getIntegerValue(token.value);
					if (options.values.indexOf(value) < 0)
						throw new DeviceRadio.Compiler.CompilerException("Value must be on of " + getListText(options.values), token);
					break;
				case 'bits':
					if (Object.prototype.toString.call( options.bits ) === '[object Array]') {
						if (options.bits.indexOf(token.bits) < 0) {
							throw new DeviceRadio.Compiler.CompilerException("Size of value must be " + getBitsText(options.bits), token);
						}
					}
					else if (token.bits !== options.bits) {
						if (options.bits == 1)
							throw new DeviceRadio.Compiler.CompilerException("Value must be boolean", token);
						else
							throw new DeviceRadio.Compiler.CompilerException("Value must be " + options.bits + " bit" + ((options.bits != 1) ? "s" : ""), token);
					}
					break;
				default:
					throw new DeviceRadio.Compiler.CompilerException("Invalid assertion", token);
				}
			}
		}
		break;
	case "TRIGGER":
		name = (token.ns !== null) ? token.ns : this.namespace;
		name += "::" + token.value;
		for (var test in options) {
			if (options.hasOwnProperty(test)) {
				switch (test) {
				case 'create':
					if (!(name in this._t)) {
						if (options.create === true) {
							this.createTrigger(name);
						}
						else if (options.create === "local") {
							if (token.ns === null) {
								this.createTrigger(name);
							}
							else throw new DeviceRadio.Compiler.CompilerException("Trigger can only be created in default namespace", token);
						}
					}
					break;
				default:
					throw new DeviceRadio.Compiler.CompilerException("Invalid assertion", token);
				}
			}
		}
		if (!(name in this._t)) throw new DeviceRadio.Compiler.CompilerException("Trigger does not exist", token);
		break;
	default:
		throw new DeviceRadio.Compiler.CompilerException("Invalid assertion", token);
	}
};
