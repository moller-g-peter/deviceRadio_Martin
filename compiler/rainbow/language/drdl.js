/**
 * DeviceRadio Definition Language patterns
 *
 * @author Christian Klemetsson
 * @version 1.0.0
 */
Rainbow.extend('drdl', [
    {
        'name': 'keyword',
        'pattern': /\b(var|task|conf|at|as|on|nvm|math|falling|raising)\b/g
    },
    {
        'name': 'keyword.math',
        'pattern': /[ \t]*(extern|swap|int8|int16|int32|uint8|uint16|uint32)[ \t]+/g
    },
    {
        'name': 'comment.docstring',
        'pattern': /(\/\*([^*]|[\r\n]|(\*+([^*\/]|[\r\n])))*\*+\/)|(\/\/.*)/g
    },
    {
        'name': 'constant.numeric.unit',
        'pattern': /(([0-9]+)(\.[0-9]+)?)([a-z]+)/ig
    },
    {
        'name': 'constant.numeric.hex',
        'pattern': /0[Xx]([0-9a-fA-F]+)/g
    },
    {
        'name': 'constant.numeric.bin',
        'pattern': /0[Bb]([01]+)/g
    },
    {
        'name': 'constant.numeric.int',
        'pattern': /[0-9]+/g
    },
    {
        'name': 'constant.numeric.pow',
        'pattern': /[0-9]+[\t ]*\^[\t ]*[0-9]+/g
    },
    {
        'name': 'constant.numeric.bool',
        'pattern': /TRUE|FALSE/ig
    },
    {
        'name': 'constant.string',
        'pattern': /\"(.*)\"/ig
    },
    {
        'name': 'trigger',
        'pattern': /#(([a-zA-Z0-9]+)::)?([a-zA-Z][a-zA-Z0-9_\-]*)/g
    },
    {
        'name': 'variable',
        'pattern': /\$(([a-zA-Z0-9]+)::)?([a-zA-Z][a-zA-Z0-9_\-]*)(\.([1-9][0-9]{0,2}))?/g
    },
    {
        'name': 'symbol',
        'pattern': /(([a-zA-Z0-9]+)::)?([a-zA-Z][a-z-A-Z0-9_\-]*)(\.([a-zA-Z][a-z-A-Z0-9_\-]*))?/g
    },
    {
        'name': 'syntax',
        'pattern': /\.|\(|\)|\[|\]|,|=/g
    },
    {
        'name': 'not',
        'pattern': /!/g
    }
]);