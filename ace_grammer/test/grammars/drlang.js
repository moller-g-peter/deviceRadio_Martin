// 1. a partial javascript grammar in simple JSON format
var js_grammar = {
        
// prefix ID for regular expressions used in the grammar
"RegExpID"                          : "RegExp::",
    
"Extra"                     : {
    
    "fold"                  : "brace"
    
},
    
// Style model
"Style"                             : {

     "comment"                      : "comment"
    ,"atom"                         : "constant"
    ,"keyword"                      : "keyword"
    ,"this"                         : "keyword"
    ,"builtin"                      : "support"
    ,"operator"                     : "operator"
    ,"identifier"                   : "identifier"
    ,"property"                     : "constant.support"
    ,"number"                       : "constant.numeric"
    ,"string"                       : "string"
    ,"regex"                        : "string.regexp"

},

// Lexical model
"Lex"                               : {
    
     "comment"                      : {"type":"comment","tokens":[
                                    // line comment
                                    // start, end delims  (null matches end-of-line)
                                    [  "//",  null ],
                                    // block comments
                                    // start,  end    delims
                                    [  "/*",   "*/" ]
                                    ]}
    ,"identifier"                   : "RE::/[_A-Za-z$][_A-Za-z0-9$]*/"
    ,"this"                         : "RE::/this\\b/"
    ,"property"                     : "RE::/[_A-Za-z$][_A-Za-z0-9$]*/"
    ,"number"                       : [
                                    // floats
                                    "RE::/\\d*\\.\\d+(e[\\+\\-]?\\d+)?/",
                                    "RE::/\\d+\\.\\d*/",
                                    "RE::/\\.\\d+/",
                                    // integers
                                    // hex
                                    "RE::/0x[0-9a-fA-F]+L?/",
                                    // binary
                                    "RE::/0b[01]+L?/",
                                    // octal
                                    "RE::/0o[0-7]+L?/",
                                    // decimal
                                    "RE::/[1-9]\\d*(e[\\+\\-]?\\d+)?L?/",
                                    // just zero
                                    "RE::/0(?![\\dx])/"
                                    ]
    ,"string"                       : {"type":"escaped-block","escape":"\\","tokens":
                                    // start, end of string (can be the matched regex group ie. 1 )
                                    [ "RE::/(['\"])/",   1 ]
                                    }
    ,"regex"                        : {"type":"escaped-block","escape":"\\","tokens":
                                    // javascript literal regular expressions can be parsed similar to strings
                                    [ "/",    "RE::#/[gimy]{0,4}#" ]
                                    }
    ,"operator"                     : {"tokens":[
                                    "+", "-", "++", "--", "%", ">>", "<<", ">>>",
                                    "*", "/", "^", "|", "&", "!", "~",
                                    ">", "<", "<=", ">=", "!=", "!==",
                                    "=", "==", "===", "+=", "-=", "%=",
                                    ">>=", ">>>=", "<<=", "*=", "/=", "|=", "&="
                                    ]}
    ,"delimiter"                    : {"tokens":[
                                    "(", ")", "[", "]", "{", "}", ",", "=", ";", "?", ":",
                                    "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "++", "--",
                                    ">>=", "<<="
                                    ]}
    ,"atom"                         : {"autocomplete":true,"tokens":[
                                    "true", "false", 
                                    "null", "undefined", 
                                    "NaN", "Infinity"
                                    ]}
    ,"keyword"                      : {"autocomplete":true,"tokens":[ 
                                     "var","task","conf","at","as","on","nvm","math","falling","raising"
                                    ]}
    ,"builtin"                      : {"autocomplete":true,"tokens":[ 
                                   "io","timer","radio","boot","i2c"
                                    ]}

},

                                
                                

// Syntax model (optional)
"Syntax"                            : {
    
    "dotProperty"                   : {"sequence":[".", "property"]}

},

// what to parse and in what order
"Parser"                            : [
                                    "comment",
                                    "number",
                                    "string",
                                    "regex",
                                    "keyword",
                                    "operator",
                                    "atom",
                                    [ "'}' | ')' | this | builtin | identifier | dotProperty", "dotProperty*" ]
                                    ]

};
