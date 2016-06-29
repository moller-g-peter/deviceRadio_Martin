/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

$('.logDiv').append('<div class="disabledWrapper"></div>');


var editorvalue = "";
var editor="";
var isOnQue=false;
var buttonBoolean = true;
var markers_present = [];
var program_b64 = null;
var compiled=false;
var function_starttime=null;

    

function ace_grammar_demo(_editor, code, langs)
{
    
    //ace/ext/language_tools
   
  //  ace.config.set('basePath', '/ace-builds/src-noconflict');
  //ace.config.set('basePath', '/ace-builds/src-noconflict');
   var Editor = ace.require("ace/editor").Editor,
         
           
   editor = ace.edit("editor"),
   
     session = editor.getSession();
      
    editor.setTheme("ace/theme/solarized_dark");


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



//    ace.config.loadModule("ace/theme/dawn", function () {
//   alert("loaded");
//
//    });
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

function excButtonQueue() {
    

          
    clearMarkers();

    $('.containerDeviceradio').html('');

    
          
  
      
      if(editorvalue.length>0){
          
          
       deviceradioProcess(editorvalue);
      // $('.exe_button_3').hide();
      // $('.exe_button_default').show();
          
      }else{
          
      // $('.exe_button_3').hide();
      // $('.exe_button_default').show();
      }
      
 
 
//    if ($(".containerDeviceradio").text().length > 0) {
//        
//      $('.exe_button_3').hide();
//      $('.exe_button_default').show();
//    }else{
//           $('.exe_button_3').hide();
//      $('.exe_button_default').show();
//        
//    }
 
 
 


}

function reloadButton() {
    

   // alert("deleted");
    var htmlvalue= document.getElementById("code").innerHTML;
  
     editor.getSession().setValue(htmlvalue);
     
     $("#code").html(htmlvalue);
     $('.reload_default').hide();
     

     
      $('.reload_exe').show();
       // alert($("#code").text());
       
        
      $('.reload_exe').fadeIn(400, function(){
      $('.reload_exe').fadeOut(400);
        //cogAnimation2();
          $('.reload_default').show();
          
          clearMarkers();
      });
     // $('.reload_exe').hide();
     // $('.reload_default').show();
}

function deviceradioProcess(text) {
    
    
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
    
    
  function_starttime = new Date();
 
$('#console').html('');

var Base64={_keyStr:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",encode:function(e){var t="";var n,r,i,s,o,u,a;var f=0;e=Base64._utf8_encode(e);while(f<e.length){n=e.charCodeAt(f++);r=e.charCodeAt(f++);i=e.charCodeAt(f++);s=n>>2;o=(n&3)<<4|r>>4;u=(r&15)<<2|i>>6;a=i&63;if(isNaN(r)){u=a=64}else if(isNaN(i)){a=64}t=t+this._keyStr.charAt(s)+this._keyStr.charAt(o)+this._keyStr.charAt(u)+this._keyStr.charAt(a)}return t},decode:function(e){var t="";var n,r,i;var s,o,u,a;var f=0;e=e.replace(/[^A-Za-z0-9\+\/\=]/g,"");while(f<e.length){s=this._keyStr.indexOf(e.charAt(f++));o=this._keyStr.indexOf(e.charAt(f++));u=this._keyStr.indexOf(e.charAt(f++));a=this._keyStr.indexOf(e.charAt(f++));n=s<<2|o>>4;r=(o&15)<<4|u>>2;i=(u&3)<<6|a;t=t+String.fromCharCode(n);if(u!=64){t=t+String.fromCharCode(r)}if(a!=64){t=t+String.fromCharCode(i)}}t=Base64._utf8_decode(t);return t},_utf8_encode:function(e){e=e.replace(/\r\n/g,"\n");var t="";for(var n=0;n<e.length;n++){var r=e.charCodeAt(n);if(r<128){t+=String.fromCharCode(r)}else if(r>127&&r<2048){t+=String.fromCharCode(r>>6|192);t+=String.fromCharCode(r&63|128)}else{t+=String.fromCharCode(r>>12|224);t+=String.fromCharCode(r>>6&63|128);t+=String.fromCharCode(r&63|128)}}return t},_utf8_decode:function(e){var t="";var n=0;var r=c1=c2=0;while(n<e.length){r=e.charCodeAt(n);if(r<128){t+=String.fromCharCode(r);n++}else if(r>191&&r<224){c2=e.charCodeAt(n+1);t+=String.fromCharCode((r&31)<<6|c2&63);n+=2}else{c2=e.charCodeAt(n+1);c3=e.charCodeAt(n+2);t+=String.fromCharCode((r&15)<<12|(c2&63)<<6|c3&63);n+=3}}return t}}


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





	var lex = new DeviceRadio.Lexer;
	var com = new DeviceRadio.Compiler;
	com.add(lex.parse(
		"task system_boot\n" +
		"  boot.register\n" +
		"  trigger(boot)\n" +
		"task transmit\n" +
		"  radio.register\n" +
		"  radio.transmit\n" +
		"task dummy on 55s\n" +
		"  var $foo\n" +
		"  $foo = !$foo\n"
	), null, "Core");
	
	// compile program
	//var compilation_message = "Program compiled successfully.\n";
        var compilation_message = "Compiled message successfully";
	try {
	   var tokens = lex.parse(data);
		com.add(tokens, null, "deviceradio.txt");
		com.optimize();
		var stats = com.generate();
		
		var program_u8 = [];
		for (var i = 0; i < stats[1].length; i++) program_u8.push(stats[1].charCodeAt(i));
                
                
		program_b64 = fromByteArray(program_u8);
              //  alert(""+program_b64);
                  compiled=true;
	}
	catch (ex) {
            $('#console').html('');
                compiled=false;
		compilation_message = ex.message;
              //  alert(compilation_message);
		//$('#btn-push').addClass('error');
//                
//              
//
                var listex=Object.getOwnPropertyNames(ex);
    //           alert(listex);
                var lineNumber="";
                   if ('lineNumber' in ex) {
                      // alert("has");
                    lineNumber =ex.lineNumber;
                }
               
                   var columnNumber="";
                   if ('columnNumber' in ex) {
                   columnNumber =ex.columnNumber;
                }
//                
            var row = lineNumber-1;
            var column = columnNumber;

             
           // document.getElementById('errorReport').innerHTML = "row"+row+" col "+column;

            var Range = ace.require('ace/range').Range;
            var marker = editor.session.addMarker(new Range(row, 0, row, 1), "myMarker", "fullLine");  /// first is number of lines to be highlighted,0,number of row, number of column  


            markers_present[markers_present.length] = marker;

            editor.session.selection.moveCursorToPosition({row: row, column: column});
            editor.session.selection.selectLineEnd();

           
                
                
       //   document.getElementById('errorReport').innerHTML = compilation_message;
        
        // $('.exe_button_3').hide();
        // $('.exe_button_default').show();
	}

	$('#console').append('<p><code>' + compilation_message + '</code></p>');




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

$(function () {

    var live = new DeviceRadioLive('http://stomp.deviceradio.net:15674/stomp', 'gateway', 'deviceradio', 'dreD8G@fRu');

// event handler for successfull connection
    live.on('connect', function () {
        $('.btn').removeClass('disabled');
    });

// event handler for disconnection
    live.on('disconnect', function () {
        $('.btn').addClass('disabled');
        alert('hello!!');
    });

// event handler for successfull firmware upload
    live.on('upload', function () {
        $('#console').prepend('<p><code>Firmware written successfully</code></p>');
         $(".progress-bar").animate({
                width: "100%"
            }, 1500).html('Upload successful');
    });

// event handler for upload errors
    live.on('uploaderror', function (reason) {
        $('#console').append('<p>Upload failed (' + reason + ')</p>');
    });

// event handler for changes in the queue
    live.on('queuechange', function (total, before_you, max) {
        // if you are first or not in queue
     // alert("b4 u"+before_you);
       
       if(isOnQue===true){
             
           
           if (!before_you) {
            $('#console').prepend('<p><code>Total number of viewers In queue: ' + total + '</code></p>');
         
            
        } else {
            
            $('#console').prepend('<p><code>In queue: ' + total + ', people before you: ' + ((before_you > 0) ? before_you : (max + '+')) + '</code></p>');
        }
           
       }
    
    });

// event handler when its your turn
    live.on('yourturn', function (status) {
        if (status) {
          //   $('.btn').removeAttr('disabled');
           //  $( ".btn" ).removeClass( "disabled" );
              
                  
               // alert(" hey i am still disabled"); 
               // $('.exec_button').attr('id', 'executeCode');
                $('.exec_button').addClass('executeCode');
                $('#console').prepend('<p><code>You are in control of the device now</code></p>');
                $( ".btn" ).removeClass( "disabled" );
                $('.exe_button_disabled').hide();
                $('.reload_button_disabled').hide();
                $('.exe_button_default').show();
                $('.reload_default').show();
                $('.exec_button').removeAttr('data-target');
                $('#console').prepend('<p><code>It is your turn</code></p>');
                $( ".progress-bar" ).removeClass( "progress-bar-info" );
                $(".progress-bar").animate({
                        width: "66%"
                    }, 1500).addClass('progress-bar-success').html('you are in control');

                // if ($('.progress-bar').hasClass('.progress-bar-info')) {
                    // $('.progress-bar').removeClass('.progress-bar-info');
                 
                // }
                // cogAnimation1();
         
                $('#myModalNotification').modal('show');
                $('#modalMessages').html('It is now your time to have control of the device');
//                 setTimeout(function(){
//                 $("#myModalNotification").modal('toggle');
//                  }, 2000);
                }
                
                else {
                $('#console').prepend('<p><code>Your turn is up</code></p>');
                $('#myModalNotification').modal('show');
                $('#modalMessages').html('Your time is now up');
                setTimeout(function(){
                $("#myModalNotification").modal('toggle');
                }, 2000);
                $( ".progress-bar" ).removeClass( "progress-bar-success" );
                
                   $(".progress-bar").animate({
                        width: "100%"
                    }, 1500).addClass('progress-bar-danger').html('Time is up');
               
                  
                $('.exec_button').attr('data-target','#myModalExecute');
                $('.btn').removeAttr('disabled');
                  
          //  alert('Your time is now up');
        }
    });


 






// connect to server
live.connect();



// program device-button pushed
    $('#btn-push').on('click', function () {
        
        
        if(compiled===true){
            isOnQue=true;
          if (!$(this).hasClass('disabled')) {
            // alert(live.queueing);
            if (!live.queueing) {
                // $('.btn').addClass('disabled');
                // put us in queue
                live.queue();
                //   alert(live.queueing);
                //alert('Your are now in the queue for getting control of the device');
                
         

                $("#myModalExecute").modal('toggle');
                $('#myModalNotification').modal('show');
                $('#modalMessages').html('Your are now in the queue .');
                setTimeout(function () {
                    $("#myModalNotification").modal('toggle');
                }, 2000);

                $(".progress-bar").animate({
                        width: "33%"
                    }, 1500).addClass('progress-bar-info').html('In Queue');

                // $('.btn').prop("disabled", true);

                // $('.disabledButtonMessage').show();
                $('.logDiv').prepend('<button class="disabledButtonMessage"></button>');
                $('.logDiv').prepend('<button class="disabledButtonReload"></button>');
                $('.exe_button_disabled').show();
                $('.reload_button_disabled').show();
                $('.exe_button_disabled').appendTo('.disabledButtonMessage');
                $('.reload_button_disabled').appendTo('.disabledButtonReload');

            } else if (live.connected && program_b64 !== null) {
                $('#console').append('<p>Uploading firmware to device</p>');
                // write firmware to device
                live.upload('38F8-932-5E41A', program_b64);
            }
        }
            
            
            
        }
        
    });

    


// wipe device-button pushed
    $('#btn-wipe').on('click', function () {
        if (!$(this).hasClass('disabled')) {
//            if (!live.queueing) {
//                $('.btn').addClass('disabled');
//                // put us in queue
//                live.queue();
//                alert('Your are now in the queue for getting control of the device');
//            } else if (live.connected) {
//                reloadButton();
//                $('#console').append('<p>Clearing all code in the device</p>');
//                // format the device
//                live.upload('38F8-932-5E41A');
//            }

          reloadButton();


        }
    });

     $('.exec_button').on('click', function () {
     
     
      if ($(this).hasClass('executeCode')) {
     //alert("now i can execute");  
      excButtonQueue();
     // alert(live.connected+""+program_b64);
      if (live.connected && program_b64 !== null && compiled===true) {
      
            $('#console').prepend('<p><code>Uploading firmware to device</code></p>');
            // write firmware to device
            live.upload('38F8-932-5E41A', program_b64);
            
            
            
              $(".progress-bar").animate({
                width: "100%"
            }, 2500).addClass('progress-bar-success').html('Uploading firmware');
          
      
            
            
           
            
            }
      
         
     }
   
     
     
     
     
 });


});


            

$('.exe_button_disabled, .reload_button_disabled').click(function(){
    // alert("poing!");
    $('.disabledWrapper').prepend('<div class="disabledMessage"><p>Button disabled until it\'s your turn</p></div>');
    // $('.disabledMessage').prepend('<p class="disabledPara">Button disabled until it\'s your turn</p>');
    $('.disabledMessage').fadeIn(70).fadeOut(70).fadeIn(70).fadeOut(70).fadeIn(70).fadeOut(70).fadeIn(70).fadeOut(70).fadeIn(70).delay(2000).fadeOut(2000);
});

    function cogAnimation1(){
        $('.exe_button_default').hide();
        $('.exe_button_1').fadeIn(300, function(){
            $('.exe_button_1').fadeOut(300);
            cogAnimation2();
        });
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
          $('.exe_button_default').show();
          // excButton();
      });
    }

function clearMarkers() {

    var markers = editor.session.getMarkers(false);

    for (var id in markers) {

        editor.session.removeMarker(id);

    }



}