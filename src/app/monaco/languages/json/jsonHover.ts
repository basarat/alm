/**
 * Had a look at https://github.com/Microsoft/vscode/blob/6e8f6596175fda10b69ee9ba33caf45b5ad7e579/extensions/javascript/src/features/packageJSONContribution.ts#L206
 *
 * To figure out how to get this.
 *
 * Basically the `jsonc-parser` is really handy:
 *
 * ```ts
 * const doc = Parser.parse(contents);
 * let node = doc.getNodeFromOffsetEndInclusive(offset);
 * let location = node.getNodeLocation();
 * ```
 * Both `node` and `location` are extremely handy
 *
 * Also validation:
 *
 ```ts
 const doc = Parser.parse(contents);

 // TODO: validation :)
 if (!doc.errors.length) {
     doc.validate(schema);
     // console.log('Schema Validation:',doc.errors,doc.warnings);
 }
 else {
     // console.log('Parse Errors:', doc.errors);
 }
 ```
 *
 */
import Parser = require('./core/jsonParser');

const packageJsonDependenciesSections = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
]

import * as utils from "../../../../common/utils";
import {Types} from "../../../../socket/socketContract";

import {cast, server} from "../../../../socket/socketClient";
import * as state from "../../../state/state";
import {onlyLastCallWithDelay} from "../../monacoUtils";
import CancellationToken = monaco.CancellationToken;
import Position = monaco.Position;

export class ProvideHover {
    provideHover(model: monaco.editor.IReadOnlyModel, pos: Position, token: CancellationToken): Promise<monaco.languages.Hover> {
        const response: monaco.languages.Hover = {
            range: null,
            contents: [],
        }

        const {filePath} = model;
        const fileName = utils.getFileName(filePath).toLowerCase();
        const offset = model.getOffsetAt(pos);

        const contents = model.getValue();
        const doc = Parser.parse(contents);
        let node = doc.getNodeFromOffsetEndInclusive(offset);
        const location = node.getNodeLocation();

        /**
         * Provide intelligence based on file name
         */
        if (fileName === "package.json") {
            /** Provide latest version hint for depencencies */
            if (packageJsonDependenciesSections.some(section => location.matches([section, '*']))) {
                const path = location.getSegments(); // e.g. ["devDependencies", "mocha"]
                let pack = path[path.length - 1];
                if (typeof pack === 'string') {
                    return getInfo(pack).then(res => {
                        if (!res.description && !res.version) return response;

                        res.description && response.contents.push(res.description);
                        res.version && response.contents.push(`Latest version: ${res.version}`);

                        return response;
                    });
                }
            }
        }

        return utils.resolve(response)
    }
}


import * as fetch from "node-fetch";
function getInfo(pack: string): Promise<{description?: string, version?: string}> {
    const queryUrl = 'http://registry.npmjs.org:80/' + encodeURIComponent(pack) + '/latest';

    return fetch(queryUrl)
        .then(function(response) {
            return response.json()
        })
        .then(function(obj) {
            let result: {
                description?: string,
                version?: string
            } = {};
            if (obj.description) {
                result.description = obj.description;
            }
            if (obj.version) {
                result.version = obj.version;
            }
            return result;
        })
        .catch((error) => {
            return {};
        });
}
