/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */



var editorvalue = "";
var editor=""; 
function ace_grammar_demo(_editor, code, langs)
{
    //  document.getElementById('editor-version').innerHTML = '1.2.0';
    //   document.getElementById('grammar-version').innerHTML = AceGrammar.VERSION;

   var Editor = ace.require("ace/editor").Editor,
     editor = ace.edit("editor"), session = editor.getSession();
     

    var main_lang, main_mode;

    for (var i = 0, l = langs.length; i < l; i++)
    {
        var lang = langs[i].language, grammar = langs[i].grammar, mode;

        // 2. parse the grammar into an ACE syntax-highlight mode
        mode = AceGrammar.getMode(grammar);
        mode.name = lang;

        if (0 === i)
        {
            // main mode
            main_lang = lang;
            main_mode = mode;

            // enable syntax validation
            main_mode.supportGrammarAnnotations = true;
            // enable auto-completion
            main_mode.supportAutoCompletion = true;
            main_mode.autocompleter.options = {prefixMatch: true, caseInsensitiveMatch: false, inContext: true};
            // enable code-folding
            main_mode.supportCodeFolding = true;
            // enable code-matching
            main_mode.supportCodeMatching = true;
        } else
        {
            // submodes
            // add any sub/inner modes to main mode
            main_mode.submode(lang, mode);
        }
    }

    // 3. use it with ACE

    // editor commands
    var commands = {
        defaults: {
            toggleCommentLines: {win: "Ctrl-L", mac: "Command-L"},
            toggleCommentBlock: {win: "Alt-L", mac: "Alt-L"}
        },
        toggleCommentLines: {
            name: "toggleCommentLines",
            exec: function (editor) {
                editor.toggleCommentLines();
            },
            bindKey: null
        },
        toggleCommentBlock: {
            name: "toggleCommentBlock",
            exec: function (editor) {
                editor.toggleBlockComment();
            },
            bindKey: null
        }
    };
    commands.toggleCommentLines.bindKey = commands.defaults.toggleCommentLines;
    commands.toggleCommentBlock.bindKey = commands.defaults.toggleCommentBlock;

    // editpr options
    ace.config.defineOptions(Editor.prototype, "editor", {
        toggleCommentLinesKey: {
            set: function (val) {
                if (val)
                    commands.toggleCommentLines.bindKey = val;
                else
                    commands.toggleCommentLines.bindKey = commands.defaults.toggleCommentLines;
            },
            value: commands.defaults.toggleCommentLines
        },
        toggleCommentBlockKey: {
            set: function (val) {
                if (val)
                    commands.toggleCommentBlock.bindKey = val;
                else
                    commands.toggleCommentBlock.bindKey = commands.defaults.toggleCommentBlock;
            },
            value: commands.defaults.toggleCommentBlock
        },
        enableToggleCommentLines: {
            set: function (val) {
                if (val)
                    this.commands.addCommand(commands.toggleCommentLines);
                else
                    this.commands.removeCommand(commands.toggleCommentLines);
            },
            value: false
        },
        enableToggleCommentBlock: {
            set: function (val) {
                if (val)
                    this.commands.addCommand(commands.toggleCommentBlock);
                else
                    this.commands.removeCommand(commands.toggleCommentBlock);
            },
            value: false
        },
        onlyKeywordsAutoComplete: {
            set: function (val) {
                if (this.getOption('enableBasicAutocompletion'))
                {
                    if (val)
                    {
                        this._completers = this._completers || this.completers.slice();
                        // keyword completer taken from the grammar mode
                        this.completers = [this.completers[2]];
                    } else if (this._completers)
                    {
                        // default completers
                        this.completers = this._completers;
                        this._completers = null;
                    }
                }
            },
            value: false
        }
    });

    ace.config.loadModule("ace/ext/language_tools", function () {

        editor.getSession().on('change', function (e) {
            var x = editor.getValue();
            // console.log(" i am empty"+x);

            if (x.length > 0) {


                editorvalue = x;

            }
            editor.selection.selectLineEnd();

            editor.find(';');
            editor.replaceAll('');


        });


        editor.setOptions({
            enableBasicAutocompletion: true,
            enableSnippets: true,
            enableToggleCommentLines: true,
            enableToggleCommentBlock: true
        });
        editor.setOptions({
            onlyKeywordsAutoComplete: true
        });
        main_mode.matcher(editor);
        editor.setValue(code, -1);
        session.setMode(main_mode);
        //session.setOptions({useWorker: false});
        session.setFoldStyle("markbeginend");
        //editor.clearSelection();
    });

    return editor;
}






var buttonBoolean = true;



function excButton() {
    
    
    
    
     
  
          
  clearMarkers();

    $('.containerDeviceradio').html('');

 
   
      $('.exe_button_default').hide();
      $('.exe_button_1').fadeIn(300, function(){
      $('.exe_button_1').fadeOut(300);
        // cogAnimation2();
          
      });
      
      if(editorvalue.length>0){
          
       deviceradioProcess(editorvalue);
          
      }else{
          
      $('.exe_button_3').hide();
      $('.exe_button_default').show();
      }
      
 
 
    if ($(".containerDeviceradio").text().length > 0) {
        
      $('.exe_button_3').hide();
      $('.exe_button_default').show();
    }else{
           $('.exe_button_3').hide();
      $('.exe_button_default').show();
        
    }
 
 
 


}



function reloadButton() {
    

   // alert("deleted");
    
  
     editor.getSession().setValue('');
     
     $("#code").html('');
     $('.reload_default').hide();
     

     
      $('.reload_exe').show();
       // alert($("#code").text());
       if ($("#code").text().length === 0) {
        
      $('.reload_exe').fadeIn(400, function(){
      $('.reload_exe').fadeOut(400);
        //cogAnimation2();
          $('.reload_default').show();
          
          clearMarkers();
      });
     // $('.reload_exe').hide();
     // $('.reload_default').show();
    }
     

}


    function cogAnimation2(){
      $('.exe_button_2').fadeIn(200, function(){
      $('.exe_button_2').fadeOut(200);
        cogAnimation3();
      });
    }
    function cogAnimation3(){
      $('.exe_button_3').fadeIn(200, function(){
      $('.exe_button_3').fadeOut(200);
       // excButton();
      });
    }


$('.desktopIDE').click(function(){
  buttonBoolean = false;
  $('.exe_button_default').show();
});

$('.reload_button').click(function(){
  $('.reload_exe').show();
});


function deviceradioProcess(text) {



    //console.log(" i am here"+text);

    var Base64 = {_keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=", encode: function (e) {
            var t = "";
            var n, r, i, s, o, u, a;
            var f = 0;
            e = Base64._utf8_encode(e);
            while (f < e.length) {
                n = e.charCodeAt(f++);
                r = e.charCodeAt(f++);
                i = e.charCodeAt(f++);
                s = n >> 2;
                o = (n & 3) << 4 | r >> 4;
                u = (r & 15) << 2 | i >> 6;
                a = i & 63;
                if (isNaN(r)) {
                    u = a = 64
                } else if (isNaN(i)) {
                    a = 64
                }
                t = t + this._keyStr.charAt(s) + this._keyStr.charAt(o) + this._keyStr.charAt(u) + this._keyStr.charAt(a)
            }
            return t
        }, decode: function (e) {
            var t = "";
            var n, r, i;
            var s, o, u, a;
            var f = 0;
            e = e.replace(/[^A-Za-z0-9\+\/\=]/g, "");
            while (f < e.length) {
                s = this._keyStr.indexOf(e.charAt(f++));
                o = this._keyStr.indexOf(e.charAt(f++));
                u = this._keyStr.indexOf(e.charAt(f++));
                a = this._keyStr.indexOf(e.charAt(f++));
                n = s << 2 | o >> 4;
                r = (o & 15) << 4 | u >> 2;
                i = (u & 3) << 6 | a;
                t = t + String.fromCharCode(n);
                if (u != 64) {
                    t = t + String.fromCharCode(r)
                }
                if (a != 64) {
                    t = t + String.fromCharCode(i)
                }
            }
            t = Base64._utf8_decode(t);
            return t
        }, _utf8_encode: function (e) {
            e = e.replace(/\r\n/g, "\n");
            var t = "";
            for (var n = 0; n < e.length; n++) {
                var r = e.charCodeAt(n);
                if (r < 128) {
                    t += String.fromCharCode(r)
                } else if (r > 127 && r < 2048) {
                    t += String.fromCharCode(r >> 6 | 192);
                    t += String.fromCharCode(r & 63 | 128)
                } else {
                    t += String.fromCharCode(r >> 12 | 224);
                    t += String.fromCharCode(r >> 6 & 63 | 128);
                    t += String.fromCharCode(r & 63 | 128)
                }
            }
            return t
        }, _utf8_decode: function (e) {
            var t = "";
            var n = 0;
            var r = c1 = c2 = 0;
            while (n < e.length) {
                r = e.charCodeAt(n);
                if (r < 128) {
                    t += String.fromCharCode(r);
                    n++
                } else if (r > 191 && r < 224) {
                    c2 = e.charCodeAt(n + 1);
                    t += String.fromCharCode((r & 31) << 6 | c2 & 63);
                    n += 2
                } else {
                    c2 = e.charCodeAt(n + 1);
                    c3 = e.charCodeAt(n + 2);
                    t += String.fromCharCode((r & 15) << 12 | (c2 & 63) << 6 | c3 & 63);
                    n += 3
                }
            }
            return t
        }}

    function addNewlines(str) {
        var result = '';
        while (str.length > 0) {
            result += str.substring(0, 80) + '\n';
            str = str.substring(80);
        }
        return result;
    }

    function syntaxHighlight(json) {
        if (typeof json != 'string') {
            json = JSON.stringify(json, undefined, 2);
        }
        json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
            var cls = 'number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'key';
                } else {
                    cls = 'string';
                }
            } else if (/true|false/.test(match)) {
                cls = 'boolean';
            } else if (/null/.test(match)) {
                cls = 'null';
            }
            return '<span class="' + cls + '">' + match + '</span>';
        });
    }

    var lex = new DeviceRadio.Lexer;
    var com = new DeviceRadio.Compiler;

    com.add(lex.parse(
            "task system_boot\n" +
            "  boot.register\n" +
            "  trigger(boot)\n" +
            "task transmit\n" +
            "  radio.register\n" +
            "  radio.transmit\n"
            ), null, "Core");




    var data = text;

    // console.log("i am text"+text);
    var html = '<div class="wrap">';

    html += '<pre class="left"><code>';
    var n = 1;
    for (var i = 0; i < data.split(/\r\n|\r|\n/).length; i++) {
        if (i)
            html += "\n";
        html += n++;
    }
    html += '</code></pre>';

    html += '<pre class="right"><code data-language="drdl">' + data + '</code></pre>';
    html += '</div>';

    //  console.log("i am text"+html);
    $('.containerDeviceradio').append(html);
    Rainbow.color();


    try {
        var tokens = lex.parse(data); // this can cause error
        com.add(tokens, null, "deviceradio.txt"); // cause err
        com.optimize(); // cause error
        var stats = com.generate(); // cause error
        document.getElementById('errorReport').innerHTML = " ";
    } catch (err) {

        document.getElementById('errorReport').innerHTML = err;
        
        $('.exe_button_3').hide();
        $('.exe_button_default').show(); 
        //  alert(""+err);
    }

    /*
     for (var i = 0; i < tokens.length; i++) {
     $('.container').append('<pre class="wrap"><code>' + syntaxHighlight(tokens[i]) + '</code></pre>');
     }
     */



    var program = "";
    var col = -1;
    for (var i = 0; i < stats[1].length; i++) {
        //var x = stats[1].charCodeAt(i).toString(16).toUpperCase();
        //x = (x.length == 1) ? '0x0' + x : '0x' + x;

        var x = stats[1].charCodeAt(i);
        h = x >> 4;
        l = x & 15;
        var m = 15;
        if (h > m)
            h = m;
        if (l > m)
            l = m;
        //x = '0x' + h.toString(16).toLowerCase() + l.toString(16).toLowerCase();
        x = '0x' + h.toString(16).toUpperCase() + l.toString(16).toUpperCase();

        if (++col == 24) {
            program += ",\n" + x;
            col = 0;
        } else if (program == "")
            program += x;
        else
            program += ", " + x;
    }

    //$('.container').append('<pre class="wrap"><code>' + addNewlines(Base64.encode(stats[1])) + '</code></pre>');
    $('.containerDeviceradio').append('<pre class="wrap"><code>\n' + program + '</code></pre>');
    $('.containerDeviceradio').append('<pre class="wrap"><code>' + syntaxHighlight(stats[0]) + '</code></pre>');

    /*
     $('.container').append('<pre class="wrap"><code>'
     + "00000000 000000000 0x0000000 0x000000000000\n"
     + "11111111 111111111 0x1111111 0x111111111111\n"
     + "22222222 222222222 0x2222222 0x222222222222\n"
     + "33333333 333333333 0x3333333 0x333333333333\n"
     + "44444444 444444444 0x4444444 0x444444444444\n"
     + "55555555 555555555 0x5555555 0x555555555555\n"
     + "66666666 666666666 0x6666666 0x666666666666\n"
     + "77777777 777777777 0x7777777 0x777777777777\n"
     + "88888888 888888888 0x8888888 0x888888888888\n"
     + "99999999 999999999 0x9999999 0x999999999999\n"
     + "AAAAAAAA AAAAAAAAA 0xAAAAAAA 0xAAAAAAAAAAAA\n"
     + "BBBBBBBB BBBBBBBBB 0xBBBBBBB 0xBBBBBBBBBBBB\n"
     + "CCCCCCCC CCCCCCCCC 0xCCCCCCC 0xCCCCCCCCCCCC\n"
     + "DDDDDDDD DDDDDDDDD 0xDDDDDDD 0xDDDDDDDDDDDD\n"
     + "EEEEEEEE EEEEEEEEE 0xEEEEEEE 0xEEEEEEEEEEEE\n"
     + "FFFFFFFF FFFFFFFFF 0xFFFFFFF 0xFFFFFFFFFFFF\n"
     + "aaaaaaaa aaaaaaaaa 0xaaaaaaa 0xaaaaaaaaaaaa\n"
     + "bbbbbbbb bbbbbbbbb 0xbbbbbbb 0xbbbbbbbbbbbb\n"
     + "cccccccc ccccccccc 0xccccccc 0xcccccccccccc\n"
     + "dddddddd ddddddddd 0xddddddd 0xdddddddddddd\n"
     + "eeeeeeee eeeeeeeee 0xeeeeeee 0xeeeeeeeeeeee\n"
     + "ffffffff fffffffff 0xfffffff 0xffffffffffff\n"
     + "xxxxxxxx xxxxxxxxx 0xxxxxxxx 0xxxxxxxxxxxxx\n"
     + ",,,,,,,, ,,,,,,,,, 0x,,,,,,, 0x,,,,,,,,,,,,\n"
     + '</code></pre>');
     */

    if (false) {
        $('.containerDeviceradio').append('<pre class="wrap"><code>' + syntaxHighlight(com._ns) + '</code></pre>');
        $('.containerDeviceradio').append('<pre class="wrap"><code>' + syntaxHighlight(com._s) + '</code></pre>');
        $('.containerDeviceradio').append('<pre class="wrap"><code>' + syntaxHighlight(com._t) + '</code></pre>');
        $('.containerDeviceradio').append('<pre class="wrap"><code>' + syntaxHighlight(com._v) + '</code></pre>');
        $('.containerDeviceradio').append('<pre class="wrap"><code>' + syntaxHighlight(com._c) + '</code></pre>');
        $('.containerDeviceradio').append('<pre class="wrap"><code>' + syntaxHighlight(com._m) + '</code></pre>');
        $('.containerDeviceradio').append('<pre class="wrap"><code>' + syntaxHighlight(com._compiler) + '</code></pre>');
    }



}




function clearMarkers() {

    var markers = editor.session.getMarkers(false);

    for (var id in markers) {

        editor.session.removeMarker(id);

    }



}