// optimize the added code
DeviceRadio.Compiler.prototype.optimize = function () {
	if (this.error) throw new DeviceRadio.Compiler.CompilerException("Compiler is in an error state");
	if (this.optimized) throw new DeviceRadio.Compiler.CompilerException("Optimizer has already been called");
	this.error = true;
	this.optimized = true;
	var that = this;

	// return an array of unique strings from an input array
	var uniq = function(input) {
		var len = input.length;
		if (len <= 1) return input;
		var ret = [];
		var found = {};
		for (var i = 0; i < len; i++) {
			var item = input[i];
			if (!(item in found)) {
				found[item] = true;
				ret.push(item);
			}
		}
		return ret;
	}
	
	// make sure variables with write has trigger sources set
	var optUpdateVariableTriggers = function() {
		for (var key in that._v) {
			if (!that._v.hasOwnProperty(key)) continue;
			var v = that._v[key];
			if (v.trigger !== null && v.write.length > 0) {
				var trigger = (typeof v.trigger === "string") ? [v.trigger] : v.trigger;
				for (var i = 0; i < v.write.length; i++) {
					for (var j = 0; j < trigger.length; j++) {
						that._t[trigger[j]].source.push(v.write[i]);
					}
				}
			}
		}
	};

	// cleanup duplicates
	var optRemoveDuplicates = function() {
		// loop and clean triggers
		for (var key in that._t) {
			if (!that._t.hasOwnProperty(key)) continue;
			that._t[key].source = uniq(that._t[key].source);
			that._t[key].target = uniq(that._t[key].target);
		}
		// loop and clean variables
		for (var key in that._v) {
			if (!that._v.hasOwnProperty(key)) continue;
			that._v[key].read = uniq(that._v[key].read);
			that._v[key].write = uniq(that._v[key].write);
			that._v[key].depend = uniq(that._v[key].depend);
		}
	};
	
	// join code if possible
	var optJoinCode = function() {
		
		// helper for joining two sub programs
		var joinSubs = function(source, target, trigger_key) {
			if (target == source) return false;
			
			// must be two code objects
			if ('code' in that._s[source] && 'code' in that._s[target]) {
				// target must not have any other triggers
				var found = false;
				for (var key2 in that._t) {
					if (!that._t.hasOwnProperty(key2) || key2 === trigger_key) continue;
					if (that._t[key2].source.length > 0 && that._t[key2].target.indexOf(target) >= 0) {
						found = true;
						break;
					}
				}
				// no other triggers found, merge the two sub programs
				if (!found) {
					// concat the code
					that._s[source].code = that._s[source].code.concat(that._s[target].code);
					that._s[target].code = [];
					// replace in variable accesses
					for (var key2 in that._v) {
						if (!that._v.hasOwnProperty(key2)) continue;
						var variable = that._v[key2];
						var pos;
						if ((pos = variable.depend.indexOf(target)) >= 0) {
							if (variable.depend.indexOf(source) < 0 && variable.write.indexOf(source) >= 0) {
								variable.depend.splice(pos, 1);
							}
							else {
								variable.depend[pos] = source;
								variable.depend = uniq(variable.depend);
							}
						}
						if ((pos = variable.read.indexOf(target)) >= 0) {
							variable.read[pos] = source;
							variable.read = uniq(variable.read);
						}
						if ((pos = variable.write.indexOf(target)) >= 0) {
							variable.write[pos] = source;
							variable.write = uniq(variable.write);
						}
					}
					// replace in trigger accesses
					for (var key2 in that._t) {
						if (!that._t.hasOwnProperty(key2)) continue;
						var trigger = that._t[key2];
						var pos;
						if ((pos = trigger.source.indexOf(target)) >= 0) {
							trigger.source[pos] = source;
							trigger.source = uniq(trigger.source);
						}
					}
					// replace in mutex dependency
					for (var key2 in that._m) {
						if (!that._m.hasOwnProperty(key2)) continue;
						var mutex = that._m[key2];
						var i;
						while ((i = mutex.lock.indexOf(target)) > -1) {
							mutex.lock[i] = source;
						}
					}
					// add the sub program type from target if privilaged
					if (that._s[target].sub_type > that._s[source].sub_type)
						that._s[source].sub_type = that._s[target].sub_type;
					return true;
				}
			}
			return false;
		};
		
		// look for candidates in the trigger table
		for (var key in that._t) {
			if (!that._t.hasOwnProperty(key)) continue;
			var entry = that._t[key];

			// merge conditional triggers if possible
			if ('conditional' in entry && entry.conditional === false && entry.source.length == 1 && entry.target.length > 0) {
				var source = entry.source[0];
				
				// hold removed targets
				var removed = [];
				
				// loop all targets
				for (var i = 0; i < entry.target.length; i++) {
					var target = entry.target[i];
					if (joinSubs(source, target, key)) removed.push(target);
				}
				
				// remove targets
				for (var i = 0; i < removed.length; i++) {
					entry.target.splice(entry.target.indexOf(removed[i]), 1);
				}
			}
			
			// merge triggers with multiple targets if possible
			while (entry.source.length > 0 && entry.target.length > 1) {
				var merged = false;
				var removed = [];
				
				// try merging each
				for (var i = 0; i < (entry.target.length - 1); i++) {
					var source = entry.target[i];
					var target = entry.target[i + 1];
					
					// make sure source doesn't have any other triggers
					var found = false;
					for (var key2 in that._t) {
						if (!that._t.hasOwnProperty(key2) || key2 === key) continue;
						if (that._t[key2].source.length > 0 && that._t[key2].target.indexOf(source) >= 0) {
							found = true;
							break;
						}
					}
					
					// try and merge
					if (!found && joinSubs(source, target, key)) {
						removed.push(target);
						merged = true;
					}
				}

				// remove targets
				for (var i = 0; i < removed.length; i++) {
					entry.target.splice(entry.target.indexOf(removed[i]), 1);
				}

				// nothing merged
				if (!merged) break;
			}
		}
	};
	
	// process overlapping variables
	var optProcessOverlapping = function() {
		// find primary parent
		for (var key in that._v) {
			if (!that._v.hasOwnProperty(key)) continue;
			var variable = that._v[key];
			if (variable.children.length == 0 || ('parent' in variable && variable.parent !== null)) continue;
			
			// find all members of the tree and put them in an array
			var variables = [key];
			var addChildren = function self (children) {
				for (var i = 0; i < children.length; i++) {
					variables.push(children[i]);
					self(that._v[children[i]].children);
				}
			};
			addChildren(variable.children);
			
			// replace triggers with arrays and save the originals
			var org_triggers = [];
			for (var i = 0; i < variables.length; i++) {
				var entry = that._v[variables[i]];
				org_triggers.push(entry.trigger);
				if (entry.trigger === null) entry.trigger = [];
				else if (typeof entry.trigger === "string") entry.trigger = [entry.trigger];
			}
			
			// get absolute offset of variable
			var getOffset = function (variable) {
				var offset = 0;
				var p = variable;
				while (true) {
					offset += ('offset' in p) ? p.offset : 0;
					if ('parent' in p && p.parent !== null) p = that._v[p.parent];
					else break;
				}
				return offset;
			};
			
			// returns true if variables overlap
			var overlap = function (var1, var2) {
				var s1 = getOffset(var1);
				var s2 = getOffset(var2);
				var e1 = s1 + var1.size;
				var e2 = s2 + var2.size;
				if (s1 >= s2 && s1 < e2) return true;
				if (s2 >= s1 && s2 < e1) return true;
				return false;
			};

			// handle the radio receive and configure triggering
			var radio = [];
			var radio_type = null;
			if ("radio" in that.objects) {
				var conf = that.objects.radio.conf.buffers;
				var radio_type = null;
				if ("receive" in conf && key === conf.receive) radio_type = "receive";
				else if ("config" in conf && key === conf.config) radio_type = "config";
				// handle
				if (radio_type !== null) {
					// remove radio dependency
					var index = variable.write.indexOf("radio");
					if (index > -1) variable.write.splice(index, 1);
					// get number of bytes of the image
					var bytes = variable.size;
					bytes = (bytes & 7) ? (bytes >> 3) + 1 : bytes >> 3;
					// create triggers
					for (var i = 0; i < bytes; i++) {
						var trigger = that.createTrigger();
						that._t[trigger].source.push("radio::" + radio_type + "::" + i);
						radio.push(trigger);
					}
				}
			}

			// share triggers on overlaping writes
			for (var i = 0; i < variables.length; i++) {
				var entry1 = that._v[variables[i]];
				if (entry1.trigger.length > 0) {
					for (var j = 0; j < variables.length; j++) {
						if (j == i) continue;
						var entry2 = that._v[variables[j]];
						// can't trigger without writes
						if (entry2.write.length == 0 || !overlap(entry1, entry2)) continue;
						// add trigger
						entry2.trigger = uniq(entry2.trigger.concat(entry1.trigger));
						// add new trigger sources
						for (var t = 0; t < entry1.trigger.length; t++) {
							that._t[entry1.trigger[t]].source = uniq(that._t[entry1.trigger[t]].source.concat(entry2.write));
						}
					}
				}
			}
			
			// map up new read and write logs
			var log = [];
			for (var i = 0; i < variables.length; i++) log.push({
				read: [],
				write: [],
				depend: []
			});
			for (var i = 0; i < variables.length; i++) {
				var entry1 = that._v[variables[i]];
				for (var j = 0; j < variables.length; j++) {
					var entry2 = that._v[variables[j]];
					if (!overlap(entry1, entry2)) continue;
					log[j].read = log[j].read.concat(entry1.read);
					log[j].write = log[j].write.concat(entry1.write);
					log[j].depend = log[j].depend.concat(entry1.depend);
				}
			}
			for (var i = 0; i < variables.length; i++) {
				var entry = that._v[variables[i]];
				entry.read = uniq(log[i].read);
				entry.write = uniq(log[i].write);
				entry.depend = uniq(log[i].depend);
			}
			
			// add radio triggering
			if (radio.length > 0) {
				// loop the triggers and find targets
				for (var i = 0; i < radio.length; i++) {
					var trigger = that._t[radio[i]];
					var entry2 = {
						offset: i * 8,
						size: 8
					};
					// loop all variables
					for (var j = 0; j < variables.length; j++) {
						var entry1 = that._v[variables[j]];
						if (!overlap(entry1, entry2)) continue;
						// add the byte trigger
						entry1.trigger.push(radio[i]);
						// add target
						if (org_triggers[j] !== null) {
							var t = that._t[org_triggers[j]];
							for (var k = 0; k < t.target.length; k++) {
								trigger.target.push(t.target[k]);
							}
						}
					}
				}

				// make sure the buffer is in ram
				var v = that._v[variables[0]];
				if (v.depend.length > 0 && !('status' in v)) v['status'] = "ram";
				
				// save the triggers in the radio object
				that.objects.radio.conf.triggers[radio_type] = radio;
			}
		}
	};
	
	// classify variables depending on usage, also remove values if not needed
	var optClassifyVariables = function() {
		for (var key in that._v) {
			if (!that._v.hasOwnProperty(key)) continue;
			var variable = that._v[key];
			
			// remove zero-value
			if (variable.size < 8 && variable.value !== null && variable.value[0] == 0) variable.value = null;
			
			// marked usage
			var status = ('status' in variable) ? variable.status : null;
			
			// decide were to store the variables
			if (status === 'ram') {}
			else if (variable.read.length == 0 && variable.write.length == 0) variable['status'] = 'skip';
			else if ('parent' in variable && variable.parent !== null) variable['status'] = 'skip';
			else if (variable.write.length == 0) variable['status'] = 'const';
			else if (variable.depend.length == 0) {
				variable['status'] = 'temp';
				variable.value = null;
			}
			else variable['status'] = 'ram';
			
			// variable was marked for other purpose (fix a more precise error)
			if (status !== null && status !== variable.status) {
				if (status == 'const') throw new DeviceRadio.Compiler.CompilerException("Variable must not be written");
				else throw new DeviceRadio.Compiler.CompilerException("A variable is marked for another purpose");
			}
		}
	};

	// step 5 - merge same-target triggers
	var optJoinTriggers = function() {
		// sort all trigger targets
		for (var key in that._t) {
			if (!that._t.hasOwnProperty(key)) continue;
			var trigger = that._t[key];
			trigger.target.sort();
		}
		// loop all triggers
		for (var key in that._t) {
			if (!that._t.hasOwnProperty(key)) continue;
			var trigger = that._t[key];
			if (!('status' in trigger)) {
				if (trigger.source.length == 0 || trigger.target.length == 0) trigger['status'] = 'skip';
				else {
					trigger['status'] = 'create';
					var edge = ('edge' in trigger) ? trigger.edge : false;
					// find candidates
					for (var key2 in that._t) {
						if (key2 == key || !that._t.hasOwnProperty(key2)) continue;
						var trigger2 = that._t[key2];
						var edge2 = ('edge' in trigger2) ? trigger2.edge : false;
						if (!('status' in trigger2) && (!edge || !edge2) && trigger2.source.length > 0 && trigger2.target.length == trigger.target.length) {
							var match = true;
							for (var i = 0; i < trigger.target.length; i++) {
								if (trigger.target[i] !== trigger2.target[i]) {
									match = false;
									break;
								}
							}
							if (match) {
								trigger2['status'] = 'merge';
								trigger2['alias'] = key;
							}
						}
					}
				}
			}
		}
	};
	
	// remove dead code
	var optRemoveDead = function() {
		// find all code objects
		for (var symbol in that._s) {
			if (!that._s.hasOwnProperty(symbol)) continue;
			var entry = that._s[symbol];
			if (!('code' in entry)) continue;
			// search for active triggers
			var active = false;
			for (var key in that._t) {
				if (!that._t.hasOwnProperty(key)) continue;
				var trigger = that._t[key];
				if (trigger.source.length == 0 || trigger.target.length == 0) continue;
				if (trigger.target.indexOf(symbol) >= 0) {
					// ignore self-triggering
					if (trigger.source.length == 1 && trigger.source[0] == symbol) {}
					else {
						active = true;
						break;
					}
				}
			}
			// code can be removed
			if (!active) {
				entry.code = [];
				entry['status'] = "skip";
				// remove from variable logs
				for (var key in that._v) {
					if (!that._v.hasOwnProperty(key)) continue;
					var variable = that._v[key];
					var pos;
					if ((pos = variable.read.indexOf(symbol)) >= 0) variable.read.splice(pos, 1);
					if ((pos = variable.write.indexOf(symbol)) >= 0) variable.write.splice(pos, 1);
					if ((pos = variable.depend.indexOf(symbol)) >= 0) variable.depend.splice(pos, 1);
				}
			}
			else entry['status'] = "create";
		}
	};

	// step 1 - process overlapping variables (from here variables may have triggers as arrays instead of null/string)
	optProcessOverlapping();
	
	// step 2 - update variable triggers
	optUpdateVariableTriggers();

	// step 3 - remove all duplicates in triggers and variables
	optRemoveDuplicates();

	// step 4 - find code pieces to join
	optJoinCode();

	// step 5 - remove dead code
	optRemoveDead();

	// step 6 - merge same-target triggers
	optJoinTriggers();
	
	// step 7 - classify variables
	optClassifyVariables();
	
	// done
	this.error = false;
};