export default function rollupCombineExport(options = {}) {
  // todo: 要将options改为数组
  const {
    moduleName,
    replaceImportStartsWith,
    virtualVariableName,
    prefix,
  } = options;
  let importRegexp = new RegExp(replaceImportStartsWith, "g");

  return {
    name: "replace-utils-code",
    transform(_code, id) {
      let code = _code;
      let isVue = id.split(".").pop().startsWith("vue");
      let regExp;
      if (isVue) {
        regExp = /<script\s*(type="jsx")?\s*>([.\s\S]*)<\/script>/g;
        code = regExp.exec(code)?.[2] ?? "";
      }

      if (importRegexp.test(code)) {
        let ast = babelParser.parse(code, {
          allowImportExportEverywhere: true,
          allowAwaitOutsideFunction: true,
          allowNewTargetOutsideFunction: true,
          errorRecovery: true,
          sourceType: "module",
          plugins: [
            "jsx",
            "flow",
          ]
        });
        const importers = ast.program.body.filter(x =>
          x.type === "ImportDeclaration" &&
          importRegexp.test(x.source?.value)
        );

        if (importers.length > 0) {

          // 删除对应的数据
          const variableName = virtualVariableName;
          let [first] = importers;
          let index = ast.program.body.indexOf(first);
          importers.forEach(item => ast.program.body.splice(ast.program.body.indexOf(item), 1));
          index = ast.program.body.length >= index ? index : ast.program.body.length;

          ast.program.body.splice(index, 0, (() => {
            let specifierFirst = {
              ...first.specifiers[0],
              type: "ImportDefaultSpecifier",
              importKind: "value",
              imported: undefined,
              local: {
                ...first.specifiers[0].local,
                name: variableName,
              },
            };
            delete specifierFirst.imported;
            return {
              ...first,
              // type: "ImportDefaultSpecifier",
              // importKind: "value",
              specifiers: [specifierFirst],
              source: {
                ...first.source,
                value: moduleName,
                raw: JSON.stringify(moduleName),
                /*value: "@/utils",
                raw: "@/utils",*/
              }
            };
          })());

          const generalCode = importers.map(item => {
            let sourceName = item.source.value.split(/@\/utils\/?/).join("");
            if (sourceName.endsWith(".js")) {
              sourceName = sourceName.split(".").slice(0, -1).join(".");
            }

            if (sourceName) {
              sourceName = `['${prefix}${sourceName}']`;
            } else {
              sourceName = `['${prefix}index']`;
            }

            return item.specifiers.map(x => {
              let moduleName = x.imported?.name || "";
              let name = x.local.name;

              if (x.imported) {
                moduleName = `['${moduleName}']`;
              }

              return `var ${name} = (${variableName}.default ? ${variableName}.default : ${variableName})${sourceName};
                      ${x.imported ? `${name} = ${name}${moduleName};` :
                  `${name} = (${name} && ${name}.default ? ${name}.default : ${name})${moduleName};`
                }`;
            }).join("\n");
          }).join(";\n");

          const generalAST = recast.parse(generalCode);
          ast.program.body.splice(index + 1, 0, ...generalAST.program.body);

          const s = new MagicString("");
          const map = s.generateMap({
            source: id,
            file: `${id.split(".").slice(0, -1).join(".")}.js.map`,
            includeContent: true
          });

          code = recast.print(ast).code;

          if (isVue) {
            _code = _code.replace(regExp, `<script>${code}</script>`);
          } else {
            _code = code;
          }

          return {
            code: _code,
            map,
            // map: {mappings: "",}
          };
        }
      }
    },
    apply: "build",
    enforce: "pre",
  };
}
