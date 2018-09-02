// import {
//   Rule,
//   SchematicContext,
//   Tree,
//   apply,
//   chain,
//   mergeWith,
//   schematic,
//   template,
//   url,
// } from '@angular-devkit/schematics';

import { Rule, SchematicContext, Tree, chain, mergeWith, template, apply, url, SchematicsException } from '@angular-devkit/schematics';

import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
import * as ts from 'typescript';
import { findNode, findNodes } from '../schematics-angular-utils/ast-utils';
import { SyntaxKind } from 'typescript';
import { insertImport } from '../schematics-angular-utils/route-utils';
import { InsertChange } from '../schematics-angular-utils/change';

export default function (options: any): Rule {
  return chain([
    installPackageTask(),
    (tree: Tree, _context: SchematicContext) => {

      if (tree.exists('/angular.json')) {
        let angularjson = JSON.parse(tree.read('/angular.json')!.toString('utf-8'));

        let defaultProject = angularjson.defaultProject as string;
        if (defaultProject) {
          let project = angularjson.projects[defaultProject];

          project!.architect!['build']['configurations']['hmr'] = {
            "fileReplacements": [
              {
                "replace": "src/environments/environment.ts",
                "with": "src/environments/environment.hmr.ts"
              }
            ] 
          };

          project!.architect!['serve']['configurations']['hmr'] = {
            "hmr": true,
            "browserTarget": defaultProject + ":build:hmr"
          };

          tree.overwrite('/angular.json', JSON.stringify(angularjson, null, 2));
        }
      }
      
      if (tree.exists('/package.json')) {
        let packagejson = JSON.parse(tree.read('/package.json')!.toString('utf-8'));
        packagejson.scripts = packagejson.scripts || {};
        if (!packagejson.scripts.hmr) {
          packagejson.scripts.hmr = "ng serve --configuration hmr";
        }
        tree.overwrite('/package.json', JSON.stringify(packagejson, null, 2));
      }
      
      if (tree.exists('/src/tsconfig.app.json')) {
        const tsconfig = JSON.parse(tree.read('/src/tsconfig.app.json')!.toString('utf-8'));
        let arr = tsconfig.compilerOptions.types as String[];
        if (arr.indexOf("node") == -1) {
          tsconfig.compilerOptions.types.push('node');
        }
        tree.overwrite('/src/tsconfig.app.json', JSON.stringify(tsconfig, null, 2));
      }

      if (tree.exists('/src/environments/environment.ts')) {
        const envSourceText = tree.read('/src/environments/environment.ts')!.toString('utf-8');
        tree.create('/src/environments/environment.hmr.ts', envSourceText);
        ts.createSourceFile('/src/environments/environment.hmr.ts', envSourceText, ts.ScriptTarget.Latest, true);
      }

      add_hmr_to_environment_ts(tree, '/src/environments/environment.ts',      'hmr', false);
      add_hmr_to_environment_ts(tree, '/src/environments/environment.prod.ts', 'hmr', false);
      add_hmr_to_environment_ts(tree, '/src/environments/environment.hmr.ts',  'hmr', true);

      if (tree.exists('/src/main.ts')) {

        let chgRecorder = tree.beginUpdate('/src/main.ts');

        let maints = readIntoSourceFile(tree, '/src/main.ts');
        // showTree(maints);
        let change = insertImport(maints, '/src/main.ts', 'hmrBootstrap', './hmr');

        if (change instanceof InsertChange) {
          chgRecorder.insertLeft(change.pos, change.toAdd)
        }        

        let platformBrowserDynamic = findNodes(maints, SyntaxKind.Identifier)
          .find(v => v.getText() === 'platformBrowserDynamic' && v.parent!.kind == SyntaxKind.CallExpression);

        let statement = platformBrowserDynamic!.parent!.parent!.parent!.parent!.parent!.parent!;

        if (statement.kind == SyntaxKind.ExpressionStatement) {
          chgRecorder.remove(statement.pos, statement.end - statement.pos);
          chgRecorder.insertRight(statement.pos, `\n\nconst bootstrap = () => platformBrowserDynamic().bootstrapModule(AppModule);

if (environment.hmr) {
  if (module[ 'hot' ]) {
    hmrBootstrap(module, bootstrap);
  } else {
    console.error('HMR is not enabled for webpack-dev-server!');
    console.log('Are you using the --hmr flag for ng serve?');
  }
} else {
  bootstrap().catch(err=>console.log(err));
}
`);
          tree.commitUpdate(chgRecorder);          
        }

      }

      return tree;
    },
    mergeWith(apply(url('./files'), [
      template({
        INDEX: options.index,
        name: options.name,
      }),
    ])),
  ]);
}

function installPackageTask() {
  return (tree: Tree, context: SchematicContext) => {
    context.addTask(
      new NodePackageInstallTask({
        packageName: '@angularclass/hmr'
      })
    );
    return tree;
  };
}

function readIntoSourceFile(host: Tree, modulePath: string): ts.SourceFile {
  const text = host.read(modulePath);
  if (text === null) {
    throw new SchematicsException(`File ${modulePath} does not exist.`);
  }
  const sourceText = text.toString('utf-8');

  return ts.createSourceFile(modulePath, sourceText, ts.ScriptTarget.Latest, true);
}

function add_hmr_to_environment_ts(tree: Tree, path: string, key: string, value: string|boolean) {
  if (tree.exists(path)) {
    let env = readIntoSourceFile(tree, path)

    // showTree(env);
    // console.log(env.text);

    let envid = findNode(env, SyntaxKind.Identifier, 'environment');
    if (envid) {
      let first = findNodes(envid.parent!, SyntaxKind.FirstPunctuation, 1)[0];
      if (first) {
        let chgRecorder = tree.beginUpdate(path);
        if (key.search(/\W+/) > -1) {
          key = `\"${key}\"`;
        }
        if (typeof(value) === 'string') 
          chgRecorder.insertRight(first.pos+2, `\n  ${key}: \"${value}\",`);
        if (typeof(value) === 'boolean')
          chgRecorder.insertRight(first.pos+2, `\n  ${key}: ${value},`);
        tree.commitUpdate(chgRecorder); 
      }
    }
  }
}

// function showTree(node: ts.Node, depth: number = 0): void {
//   let indent = ''.padEnd(depth*4, ' ');
//   console.log(indent + ts.SyntaxKind[node.kind]);
//   if (node.getChildCount() === 0) {
//       console.log(indent + '    Text: [' + node.getText() + ']');
//   }

//   for(let child of node.getChildren()) {
//       showTree(child, depth+1);
//   }
// }
