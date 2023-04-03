import virtual from "@rollup/plugin-virtual";

const DEFAULT_NAME = "multi-entry.js",
  // VAR_BASE_NAME = "VAR__VIRTUAL_MULTI_ENTRY_",
  VAR_EXTEND_NAME = "VAR__VIRTUAL_MULTI_ENTRY_EXTEND_",
  VAR_LOCAL_NAME = "VAR__VIRTUAL_MULTI_ENTRY_LOCAL_"
;

/*
  @param config.input 输出文件名
  @param config.prefix 导出模块的前缀
  @param config.depth 基于process.cwd()/package.json下的路径过滤层级
 */
export default function multiEntryDefaultAll(config = {}) {
  let inputName = config.input ?? DEFAULT_NAME;
  let prefix = config.prefix ?? "", depth = config.depth ?? 0;

  let virtualEntry,
    originInput;

  return {
    config: () => ({
      build: {
        commonjsOptions: {
          defaultIsModuleExports: "auto",
        }
      }
    }),
    options(options) {
      originInput = options.input;
      return {
        ...options,
        input: inputName,
      };
    },

    outputOptions(options) {
      return {
        ...options,
        entryFileNames: inputName
      };
    },
    buildStart(options) {
      let entries = originInput.map((path, _) => {
        // process.cwd()/folder1/folder2/entry.js ->
        let exportName = path.replace(process.cwd(), "").split(".")[0].split(/[/\\]/g).splice(depth).join("/");

        if (prefix) {
          exportName = prefix + exportName;
        }
        //default: ${VAR_BASE_NAME}${_},\n
        return (`
          import * as ${VAR_EXTEND_NAME}${_} from ${JSON.stringify(path)}
          const ${VAR_LOCAL_NAME}${_} = {
            [${JSON.stringify(exportName)}]:{
              ...(${VAR_EXTEND_NAME}${_} ?? {})
            }
          };
        `);
      }).join("\n");

      const entriesDefault = `\n export default {\n${originInput.map((x, _) => `...${VAR_LOCAL_NAME}${_}`).join(",\n")}}; \n`;

      virtualEntry = virtual({[options.input]: entries + entriesDefault});
    },
    async resolveId(id, importer) {
      return virtualEntry && virtualEntry.resolveId(id, importer);
    },
    load(id) {
      return virtualEntry && virtualEntry.load(id);
    },
    apply: "build",
  };
}
