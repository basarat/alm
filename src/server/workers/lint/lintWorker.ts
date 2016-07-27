/**
 * The heart of the linter
 */

/**
 * Load up TypeScript
 */
import * as byots  from "byots";
const ensureImport = byots;

import * as sw from "../../utils/simpleWorker";
import * as contract from "./lintContract";

import {resolve, timer} from "../../../common/utils";
import * as types from "../../../common/types";
import {LanguageServiceHost} from "../../../languageServiceHost/languageServiceHost";
import {isFileInTypeScriptDir} from "../lang/core/typeScriptDir";
import {ErrorsCache} from "../../utils/errorsCache";

/** Bring in tslint */
import * as Linter from "tslint";
/** Tslint typings. Only use in type annotations */
import {IConfigurationFile} from "../../../../node_modules/tslint/lib/configuration";
import {RuleFailure} from "../../../../node_modules/tslint/lib/language/rule/rule";

const linterMessagePrefix = `[LINT]`

namespace Worker {
    export const setProjectData: typeof contract.worker.setProjectData = (data) => {
        LinterImplementation.setProjectData(data);
        return resolve({});
    }
}

// Ensure that the namespace follows the contract
const _checkTypes: typeof contract.worker = Worker;
// run worker
export const {master} = sw.runWorker({
    workerImplementation: Worker,
    masterContract: contract.master
});

/**
 * The actual linter stuff lives in this namespace
 */
namespace LinterImplementation {

    /** The tslint linter takes a few configuration options before it can lint a file */
    interface LinterConfig {
        projectData: types.ProjectDataLoaded;
        program: ts.Program;
    }
    let linterConfig: LinterConfig | null = null;

    /** We only do this once per project change */
    let informedUserAboutMissingConfig: boolean = false;

    /** Our error cache */
    const errorCache = new ErrorsCache();
    errorCache.errorsDelta.on(master.receiveErrorCacheDelta);

    /**
      * This is the entry point for the linter to start its work
      */
    export function setProjectData(projectData: types.ProjectDataLoaded) {
        /** Reinit */
        errorCache.clearErrors();
        informedUserAboutMissingConfig = false;
        linterConfig = null;

        /**
         * Create the program
         */
        const languageServiceHost = new LanguageServiceHost(projectData.configFile.project.compilerOptions);

        // Add all the files
        projectData.filePathWithContents.forEach(({filePath, contents}) => {
            languageServiceHost.addScript(filePath, contents);
        });
        // And for incremental ones lint again
        languageServiceHost.incrementallyAddedFile.on((data) => {
            //  console.log(data); // DEBUG
            lintAgain();
        });

        const languageService = ts.createLanguageService(languageServiceHost, ts.createDocumentRegistry());
        const program = languageService.getProgram();

        /**
         * Now create the tslint config
         */
        linterConfig = {
            projectData,
            program
        };

        lintAgain();
    }

    /**
     * Called whenever
     *  - a file is edited
     *  - added to the compilation context
     */
    function lintAgain() {
        const sourceFiles = linterConfig.program.getSourceFiles().filter(x => !isFileInTypeScriptDir(x.fileName));
        if (!sourceFiles.length) return;

        /** Look for tslint.json by findup from the project dir */
        const projectDir = linterConfig.projectData.configFile.projectFileDirectory;
        const configurationPath = Linter.findConfigurationPath(null, projectDir);
        // console.log({configurationPath}); // DEBUG
        /** lint abort if the config is not ready present yet */
        if (!configurationPath) {
            if (!informedUserAboutMissingConfig) {
                informedUserAboutMissingConfig = true;
                console.log(linterMessagePrefix, 'No tslint configuration found.');
            }
            return;
        }

        /** We have our configuration file. Now lets convert it to configuration :) */
        const configuration = Linter.loadConfigurationFromPath(configurationPath);
        /** Also need to setup the rules directory */
        const possiblyRelativeRulesDirectory = configuration.rulesDirectory;
        const rulesDirectory = Linter.getRulesDirectories(possiblyRelativeRulesDirectory, configurationPath);

        /** Now start the lazy lint */
        lintWithCancellationToken({ configuration, rulesDirectory });
    }

    /** TODO: support cancellation token */
    function lintWithCancellationToken(
        {configuration, rulesDirectory}
            : { configuration: IConfigurationFile, rulesDirectory: string | string[] }
    ) {
        const sourceFiles =
            linterConfig.program.getSourceFiles()
                .filter(x => !x.isDeclarationFile);

        console.log(linterMessagePrefix, 'About to start linting files: ', sourceFiles.length); // DEBUG

        // Note: tslint is a big stingy with its definitions so we use `any` to make our ts def compat with its ts defs.
        const program = linterConfig.program as any;

        /** Used to push to the errorCache */
        const filePaths: string[] = [];
        let errors: CodeError[] = [];

        const time = timer();
        sourceFiles.forEach(sf => {
            const filePath = sf.fileName;
            const contents = sf.getText();


            const linter = new Linter(filePath, contents, { configuration, rulesDirectory }, program);
            const lintResult = linter.lint();

            filePaths.push(filePath);
            if (lintResult.failureCount) {
                // console.log(linterMessagePrefix, filePath, lintResult.failureCount); // DEBUG
                errors = errors.concat(
                    lintResult.failures.map(
                        le => lintErrorToCodeError(le,contents)
                    )
                );
            }
        });

        /** Push to errorCache */
        errorCache.setErrorsByFilePaths(filePaths, errors);
        console.log(linterMessagePrefix, 'Lint complete', time.seconds);

        /**
         * TODO: lint
         *
         * Load the linter config
         * create the Linter for each file and get its output
         *
         */
    }

    /** Utility */
    function lintErrorToCodeError(lintError: RuleFailure, contents: string): CodeError {
        const start = lintError.getStartPosition().getLineAndCharacter();
        const end = lintError.getEndPosition().getLineAndCharacter();
        const preview = contents.substring(
            lintError.getStartPosition().getPosition(),
            lintError.getEndPosition().getPosition()
        );

        const result: CodeError = {
            filePath: lintError.getFileName(),
            message: lintError.getFailure(),
            from: {
                line: start.line,
                ch: start.character
            },
            to: {
                line: end.line,
                ch: end.character
            },
            preview: preview
        }
        return result;
    }
}
