// Type definitions for anjdreas-nested-yargs.js 1.0.3
// Project:0.6.0-1 
// Definitions by: Andreas Gullberg Larsen <https://github.com/anjdreas>
// Definitions: NOT UPLOADED YET
// https://github.com/borisyankov/DefinitelyTyped

declare module "anjdreas-nested-yargs" {
    import Yargs = require('yargs');

    export interface Command {
        name: string;
        description: string;
        options: any;
        parent: Category;
        path: string;

        run: (yargs: Yargs.Argv) => {};
    }

    export interface Category extends Command {
        commands: any[];
        command: (cmd: Command) => {};
    }

    export function createApp(options?: any): Category;
    export function run(app: Category, yargs: Yargs.Argv): Category;

    export function createCategory(name: string, description: string, options?: any): Category;

    export function createCommand(name: string, description: string, options?: any): Command;
}
