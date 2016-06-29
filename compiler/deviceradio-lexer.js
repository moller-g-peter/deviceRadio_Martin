DeviceRadio.Lexer = function () {
	// requires aaditmshah/lexer
	if (typeof Lexer == "undefined") throw new Error("Dependency lexer is missing");

	this._row = 1;
	this._col = 1;
	var that = this;
	
	// default error function
	this._err = function (lexeme) {
		throw new Error("Syntax error on row " + that._row + " at position " + that._col);
	};

	// create a new lexer with a default error function
	this._lexer = new Lexer(this._err);
	
	// create a basic token and progress the counters
	this._token = function (lexeme, type) {
		var token = {
			row: this._row,
			col: this._col
		};
		if (type !== undefined) token['type'] = type;
		this._col += lexeme.length;
		return token;
	};
	
	// count number of bits in a value
	this._countBits = function (value) {
		var ret = 1;
		var val = value[value.length - 1];
		if (val & 0x80) ret = 8;
		else if (val & 0x40) ret = 7;
		else if (val & 0x20) ret = 6;
		else if (val & 0x10) ret = 5;
		else if (val & 0x08) ret = 4;
		else if (val & 0x04) ret = 3;
		else if (val & 0x02) ret = 2;
		ret += (value.length - 1) * 8;
		return ret;
	};

	// parse binary to byte array
	this._parseBin = function (value) {
		var pad = "0000000";
		ret = [];
		// pad to 8 bits
		if (value.length & 7) value = pad.substr(0, 8 - (value.length & 7)) + value;
		// remove leading 8 in a row zeroes
		while (value.length > 8 && value.substr(0, 8) == "00000000") value = value.substr(8, value.length - 8);
		// convert
		for (var i = 0; i < value.length; i += 8) {
			ret.unshift(parseInt(value.substr(i, 8), 2));
		}
		return ret;
	};

	// parse hex to byte array
	this._parseHex = function (value) {
		var ret = [];
		// pad to 8 bits
		if (value.length & 1) value = '0' + value;
		// remove leading 00 values
		while (value.length > 2 && value.substr(0, 2) == "00") value = value.substr(2, value.length - 2);
		// convert
		for (var i = 0; i < value.length; i += 2) {
			ret.unshift(parseInt(value.substr(i, 2), 16));
		}
		return ret;
	};

	// parse oct to byte array
	this._parseOct = function (value) {
		var ret = [];
		// remove leading 0 values
		while (value.length > 1 && value.substr(0, 1) == "0") value = value.substr(1, value.length - 1);
		// convert TODO must be repacked from 3-bit per char to 8-bit
		for (var i = 0; i < value.length; i++) {
			ret.unshift(parseInt(value.substr(i, 1), 8));
		}
		return ret;
	};
	
	// parse integer to byte array
	this._parseInt = function (value) {
		var val = parseInt(value, 10);
		if (isNaN(val)) that._err();
		return this._parseHex(val.toString(16));
	};
	
	this._lexer
	// comments
	.addRule(/(\/\*([^*]|[\r\n]|(\*+([^*\/]|[\r\n])))*\*+\/)|(\/\/.*)/, function (lexeme) {
		var token = that._token("", "COMMENT");
		var newlines = lexeme.split("\n").length - 1;
		if (newlines > 0) {
			that._row += newlines;
			that._col = lexeme.substring(lexeme.lastIndexOf("\n")).length;
		}
		else that._col += lexeme.length;
		return token;
	})
	// new lines
	.addRule(/(\r\n|\n)/gm, function () {
		var token = that._token("", "EOL");
		that._row++;
		that._col = 1;
		return token;
	})
	// indentation
	.addRule(/^[\t ]*/gm, function (lexeme) {
		var token = that._token(lexeme, "LINE");
		var indent = 0;
		for (var i = 0; i < lexeme.length; i++) {
			indent += (lexeme.substr(i, 1) === "\t") ? 4 - (indent & 3) : 1;
		}
		token['indent'] = indent;
		return token;
	})
	// white spaces
	.addRule(/[\t ]*/, function (lexeme) {
		that._col += lexeme.length;
	})
	// keywords
	.addRule(/var|task|conf|at|as|on|nvm|math|=|,|\(|\)|\-|\+|\*|\/|<<|>>|\^/, function (lexeme) {
		var token = that._token(lexeme, "KEYWORD");
		token['value'] = lexeme;
		return token;
	})
	// variable
	.addRule(/(![\t ]*)?\$(([a-zA-Z0-9]+)::)?([a-zA-Z][a-zA-Z0-9_\-]*)(\.([1-9][0-9]{0,2}))?(\[[\t ]*([0-9]{1,3})[\t ]*\])?/, function (lexeme, not, match1, ns, value, match4, bits, match6, index) {
		var token = that._token(lexeme, "VARIABLE");
		token['ns'] = (ns !== undefined) ? ns : null;
		token['value'] = value;
		token['bits'] = (bits !== undefined) ? +bits : null;
		token['index'] = (index !== undefined) ? +index : null;
		token['invert'] = (not !== undefined) ? true : false;
		return token;
	})
	// trigger
	.addRule(/#(([a-zA-Z0-9]+)::)?([a-zA-Z][a-zA-Z0-9_\-]*)/, function (lexeme, match1, ns, value) {
		var token = that._token(lexeme, "TRIGGER");
		token['ns'] = (ns !== undefined) ? ns : null;
		token['value'] = value;
		return token;
	})
	// true false
	.addRule(/TRUE|FALSE/i, function (lexeme) {
		var token = that._token(lexeme, "INTEGER");
		token['value'] = (lexeme.toUpperCase() == "TRUE") ? [1] : [0];
		token['bits'] = 1;
		token['hint_bits'] = token['bits'];
		return token;
	})
	// hex integer
	.addRule(/0[Xx]([0-9a-fA-F]+)/, function (lexeme, hex) {
		var token = that._token(lexeme, "INTEGER");
		token['value'] = that._parseHex(hex);
		token['bits'] = that._countBits(token['value']);
		token['hint_bits'] = hex.length * 4;
		return token;
	})
	// binary
	.addRule(/0[Bb]([01]+)/, function (lexeme, bin) {
		var token = that._token(lexeme, "INTEGER");
		token['value'] = that._parseBin(bin);
		token['bits'] = that._countBits(token['value']);
		token['hint_bits'] = bin.length;
		return token;
	})
	// octal
	/*
	.addRule(/0[Oo]([0-7]+)/, function (lexeme, oct) {
		var token = that._token(lexeme, "INTEGER");
		token['value'] = that._parseOct(oct);
		token['bits'] = that._countBits(token['value']);
		token['hint_bits'] = oct.length * 3;
		return token;
	})
	*/
	// integer
	.addRule(/[0-9]+/, function (lexeme) {
		var token = that._token(lexeme, "INTEGER");
		token['value'] = that._parseInt(lexeme);
		token['bits'] = that._countBits(token['value']);
		token['hint_bits'] = token['bits'];
		return token;
	})
	// numbers with units
	.addRule(/(([0-9]+)(\.[0-9]+)?)([a-z]+)/i, function (lexeme, value, match2, match3, unit) {
		var num = Number(value);
		if (isNaN(num)) that._err();
		switch (unit.toLowerCase()) {
		case 'ms':
			break;
		case 's':
			num *= 1000;
			break;
		case 'm':
			num *= 60000;
			break;
		case 'h':
			num *= 3600000;
			break;
		case 'd':
			num *= 86400000;
			break;
		case 'hz':
			if (num == 0) that._err();
			num = 1000 / num;
			break;
		default:
			that._err();
			break;
		}
		var token = that._token(lexeme, "INTEGER");
		token['value'] = that._parseInt(Math.round(num));
		token['bits'] = that._countBits(token['value']);
		token['hint_bits'] = token['bits'];
		return token;
	})
	// symbol
	.addRule(/(![\t ]*)?(([a-zA-Z0-9]+)::)?([a-zA-Z][a-z-A-Z0-9_\-]*)(\.([a-zA-Z][a-z-A-Z0-9_\-]*))?/, function (lexeme, not, match1, ns, value, match4, sub) {
		var token = that._token(lexeme, "SYMBOL");
		token['ns'] = (ns !== undefined) ? ns : null;
		token['value'] = value;
		token['call'] = (sub !== undefined) ? sub : null;
		token['invert'] = (not !== undefined) ? true : false;
		return token;
	})
	// string
	.addRule(/\"(.*)\"/, function (lexeme, value) {
		var escape = {
			a: 0x07,
			b: 0x08,
			f: 0x0c,
			n: 0x0a,
			r: 0x0d,
			t: 0x09,
			v: 0x0b,
			"\\": 0x5c,
			"'": 0x27,
			"\"": 0x22,
			"?": 0x3f
		};
		var values = [];
		var i = 0;
		var e = 0;
		var t;
		while (i < value.length) {
			var c = value.charCodeAt(i);
			if (c < 0 || c > 255 || isNaN(c)) that._err();
			// handle escape
			if (e == 1) {
				if (String.fromCharCode(c) in escape) {
					e = 0;
					values.push(escape[String.fromCharCode(c)]);
				}
				else if (c == 120) e++;
				else that._err();
			}
			else if (e == 2) {
				t = String.fromCharCode(c);
				e++;
			}
			else if (e == 3) {
				t += String.fromCharCode(c);
				if (! /^[a-fA-F0-9]+$/.test(t)) that._err();
				t = parseInt(t, 16);
				if (isNaN(t)) that._err();
				values.push(t);
				e = 0;
			}
			else if (e) that._err();
			// check if escape
			else if (c == 92) {
				e++;
			}
			// save in values
			else values.push(c);
			i += 1;
		}
		if (e) that._err();
		var token = that._token(lexeme, "INTEGER");
		token['value'] = values;
		token['bits'] = values.length * 8;
		token['hint_bits'] = token['bits'];
		return token;
	});
};
DeviceRadio.Lexer.prototype.parse = function (data) {
	var tokens = [];
	var token;
	var last = null;
	var list = [];
	
	// handle indents
	var indent = [];
	var lastIndent = null;
	
	this._lexer.setInput(data);
	this._row = 1;
	this._col = 1;
	
	var isComma = function(t) {
		return (t.type == "KEYWORD" && t.value == ",");
	};
	var isLine = function(t) {
		return (t.type == "LINE");
	};
	var isEol = function(t) {
		return (t.type == "EOL");
	};
	var isComment = function(t) {
		return (t.type == "COMMENT");
	};

	var errorComma = function(t) {
		throw new Error("Syntax error on row " + t.row + " at position " + t.col);
	};

	var finalizeList = function() {
		if (list.length > 0) {
			tokens.push({
				type: "ARRAY",
				row: list[0].row,
				col: list[0].col,
				ns: list[0].ns,
				value: list
			});
			list = [];
		}
	};

	while ((token = this._lexer.lex()) !== undefined) {
		if (isComment(token)) {
			continue;
		}
		else if (isLine(token)) {
			lastIndent = token;
			continue;
		}
		else if (isEol(token)) {
			if (last === null) {}
			else if (isComma(last) || list.length == 0) {
				finalizeList();
				tokens.push(last);
			}
			else {
				list.push(last);
				finalizeList();
			}
		}
		else if (isComma(token)) {
			if (last !== null) {
				if (isComma(last)) errorComma();
				else if (!isEol(last)) list.push(last);
				else {
					finalizeList();
					tokens.push(last);
				}
			}
			else errorComma();
		}
		else if (last !== null) {
			if (list.length > 0) {
				if (!isComma(last)) {
					list.push(last);
					finalizeList();
				}
			}
			else tokens.push(last);
		}

		// handle indents
		if (lastIndent !== null) {
			if (!isLine(token)) {

				// first
				if (!indent.length) indent.push(lastIndent.indent);
				// indent
				else if (lastIndent.indent > indent[indent.length - 1]) {
					lastIndent.type = "INDENT";
					tokens.push(lastIndent);
					indent.push(lastIndent.indent);
				}
				// outdent
				else if (lastIndent.indent < indent[indent.length - 1]) {
					lastIndent.type = "OUTDENT";
					while (indent.length > 0 && lastIndent.indent < indent[indent.length - 1]) {
						tokens.push(lastIndent);
						indent.pop();
					}
				}
			}
			lastIndent = null;
		}

		// add the last
		last = token;
	}
	
	// handle last token
	if (last !== null) {
		if (isComma(last)) errorComma();
		else if (list.length) {
			if (!isEol(last)) {
				list.push(last);
				finalizeList();
			}
			else tokens.push(last);
		}
		else tokens.push(last);
		if (!isEol(last)) tokens.push(this._token("", "EOL"));
	}
	else tokens.push(this._token("", "EOL"));
	
	// add missing outdents
	while (indent.length > 1) {
		tokens.push(this._token("", "OUTDENT"));
		indent.pop();
	}
	
	return tokens;
};
