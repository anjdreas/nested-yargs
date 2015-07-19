var Bluebird = require('bluebird');
var Colors = require('colors');
var Yargs = require('yargs');
var _ = require('lodash');

function Category (name, description, options) {
    this.commands = {};
    this.name = name || '$0';
    this.description = description || '';
    this.options = options || {};
    this.parent = null;
    
    Object.defineProperty(this, 'path', {
        enumerable: true,
        get: function () {
            return this.parent
                ? this.parent.path.concat([this.name])
                : [this.name];
        }
    });
}

Category.prototype.command = function (command) {
    this.commands[command.name] = command;
    
    command.parent = this;
    
    return this;
};

Category.prototype.run = function (yargs) {
    var self = this;
    var errorHandler = createErrorHandler(yargs);
    
    _.forEach(this.commands, function (command) {
        yargs.command(command.name, command.description, command.run.bind(command));
    });
        
    if (this.options.setup) this.options.setup(yargs);
    if (this.options.options) yargs.options(this.options.options);
    if (this.options.examples) _.forEach(this.options.examples, yargs.example.bind(yargs));
    
    yargs
        .usage('Usage: ' + this.path.join(' ') + ' <command>')
        .check(function (argv) {
            var commandName = argv._[self.path.length - 1];
            var command = self.commands[commandName];
            
            if (!commandName) throw new Error('Please enter a valid command.');
            if (!command) throw new Error('No such command `' 
                + self.path.slice(1).join(' ')+ ' '
                + commandName + '`');

            return true;
        })
        .demand(self.path.length, 'Please enter a valid command.')
        .fail(errorHandler);

    yargs.help('help');
        
    var argv = yargs.argv;
    
    return argv;
};


function Command (name, description, options) {
    this.name = name || '$0';
    this.description = description || '';
    this.parent = null;
    this.options = _.defaultsDeep(options || {}, {
        params: '',
    });
    
    Object.defineProperty(this, 'path', {
        enumerable: true,
        get: function () {
            return this.parent
                ? this.parent.path.concat([this.name])
                : [this.name];
        }
    });
}

Command.prototype.run = function (yargs) {
    var self = this;
    var errorHandler = createErrorHandler(yargs);
    
    if (this.options.setup) this.options.setup(yargs);
    if (this.options.options) yargs.options(this.options.options);
    if (this.options.examples) _.forEach(this.options.examples, yargs.example.bind(yargs));
    
    yargs
        .check(function (argv) {
            // We can't use `yargs.strict()` because it is possible that
            // `options.setup` changes the options during execution and this
            // seems to interfere with the timing for strict mode.
            // Additionally, `yargs.strict()` does not seem to handle pre-
            // negated params like `--no-parse`.
            checkForUnknownArguments(yargs, argv);
            
            if (self.options.params) parseParams(yargs, argv, self);
            
            return true;
        })
        .fail(errorHandler)
        .usage('Usage: ' + this.path.join(' ')
            + ' [options]'
            + (this.options.params ? ' ' + this.options.params : ''));
    
    yargs.help('help');
        
    var argv = yargs.argv;
    
    if (this.options.handler)
        Bluebird.try(this.options.handler.bind(this, argv))
            .catch(errorHandler);
    
    return argv;
};


function createErrorHandler (yargs) {
    return function (err) {

        // Due to how nested categories and commands keep re-evaluating argv property,
        // which calls parseArgs(), which then throws Error in order to 
        // show the help page, the Error is instead thrown multiple times and
        // causes the error screen to render multiple times.
        // This problem arose when I called yargs.exitProcess(false) to prevent yargs
        // from exiting the process on error, in order to keep the prompt alive for new input.
        if (!yargs.hasShownHelpScreen) {
            yargs.showHelp();
            console.log((err.message || err).red);
            yargs.hasShownHelpScreen = true;
        }

        // Original code was to exit process here, but I forked the repo
        // in order to replace it with an exception instead, which was
        // yargs' own error handling behavior, but that resulted the
        // multiple help pages as described above.
//        throw new Error(err.message || err);
//        process.exit(1);
    };
}

// Adapted from: https://github.com/bcoe/yargs/blob/master/lib/validation.js#L83-L110
function checkForUnknownArguments (yargs, argv) {
    var aliasLookup = {};
    var descriptions = yargs.getUsageInstance().getDescriptions();
    var demanded = yargs.getDemanded();
    var unknown = [];
    
    Object.keys(yargs.parsed.aliases).forEach(function (key) {
        yargs.parsed.aliases[key].forEach(function (alias) {
            aliasLookup[alias] = key;
        });
    });
    
    Object.keys(argv).forEach(function (key) {
        if (key !== '$0' && key !== '_' && key !== 'params' &&
            !descriptions.hasOwnProperty(key) &&
            !demanded.hasOwnProperty(key) &&
            !aliasLookup.hasOwnProperty('no-' + key) &&
            !aliasLookup.hasOwnProperty(key)) {
                unknown.push(key);
        }
    });
    
    if (unknown.length === 1) {
        throw new Error('Unknown argument: ' + unknown[0]);
    } else if (unknown.length > 1) {
        throw new Error('Unknown arguments: ' + unknown.join(', '));
    }
}

function parseParams (yargs, argv, command) {
    var required = 0;
    var optional = 0;
    
    argv.params = {};
    
    command.options.params.replace(/(<[^>]+>|\[[^\]]+\])/g,
        function (match) {
            var isRequired = match[0] === '<';
            var param = match.slice(1, -1);
            
            if (isRequired && optional > 0)
                throw new Error('Optional parameters must be specified last');
            
            if (isRequired) required++;
            else optional++;
            
            var value = argv._[command.path.length - 2 + required + optional];
            
            if (isRequired && !value) throw new Error('Parameter '
                + '`' + param + '` is required.');
            
            argv.params[param] = value;
        });
}

exports.createApp = function (options) {
    return new Category('$', '', options);
};

exports.createCategory = function (name, description, options) {
    return new Category(name, description, options);
};

exports.createCommand = function (name, description, options) {
    return new Command(name, description, options);
};


exports.run = function (command, yargs) {
    var argv = command.run(yargs || Yargs);
    
    return argv;
};