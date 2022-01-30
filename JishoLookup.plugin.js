/**
 * @name JishoLookup
 * @author sharmavins23
 * @updateUrl https://raw.githubusercontent.com/sharmavins23/JishoLookup/JishoLookup.plugin.js
 * @authorLink https://github.com/sharmavins23
 * @source https://github.com/sharmavins23/JishoLookup/JishoLookup.plugin.js
 */

const config = {
    info: {
        name: "JishoLookup",
        authors: [
            {
                name: "sharmavins23",
                discord_id: "236964881213947914",
                github_username: "sharmavins23",
            },
        ],
        version: "1.0.0",
        description:
            "Search for words on Jisho.org. Select a word, right click and press Jisho to see its definition.",
        github_raw:
            "https://raw.githubusercontent.com/sharmavins23/JishoLookup/JishoLookup.plugin.js",
    },
};

const customCSS = `.Jisho-Word {
    clear: left;
    color: var(--header-primary);
    font-size: 1.3em;
    text-align: center;
    font-weight: bold;
    text-decoration: underline;
}
.Jisho-Title {
    font-weight: 600;
    color: var(--text-normal);
    font-size: 1.1em;
}
.Jisho-Text {
    color: var(--text-normal);
    padding-bottom: 15px;
}
.Jisho-Image {
    float: left;
    margin-bottom: 30;
}
.Jisho-Info {
    color: var(--text-normal);
    font-size: 0.9em;
    padding-top: 15px;
}
.Jisho-PartOfSpeech {
    font-weight: bold;
}
.Jisho-JLPT {
    font-weight: bold;
}
.Jisho-Wrapper {
    -webkit-user-select: text;
}
.Jisho-Definition {
    background-color: var(--background-secondary);
    border-radius: 15px;
    padding: 10px;
    margin-top: 20px;
}
`;

class PluginLibDNE {
    constructor() {
        this._config = config;
    }
    getName() {
        return config.info.name;
    }
    getAuthor() {
        return config.info.authors.map((a) => a.name).join(", ");
    }
    getDescription() {
        return config.info.description;
    }
    getVersion() {
        return config.info.version;
    }
    load() {
        BdApi.showConfirmationModal(
            "Library Missing",
            `The library plugin needed for **${config.info.name}** is missing. Please click Download Now to install it.`,
            {
                confirmText: "Download Now",
                cancelText: "Cancel",
                onConfirm: () => {
                    require("request").get(
                        "https://rauenzi.github.io/BDPluginLibrary/release/0PluginLibrary.plugin.js",
                        async (error, response, body) => {
                            if (error)
                                return require("electron").shell.openExternal(
                                    "https://betterdiscord.app/Download?id=9"
                                );
                            await new Promise((r) =>
                                require("fs").writeFile(
                                    require("path").join(
                                        BdApi.Plugins.folder,
                                        "0PluginLibrary.plugin.js"
                                    ),
                                    body,
                                    r
                                )
                            );
                        }
                    );
                },
            }
        );
    }
    start() {}
    stop() {}
}

const PluginLibExists = ([Plugin, Library]) => {
    (([Plugin, Library]) => {
        const customCSS = customCSS;
        const { Toasts, WebpackModules, DCM, Patcher, React, Settings } = {
            ...Library,
            ...BdApi,
        };
        const { SettingPanel, Switch, Slider, RadioGroup } = Settings;

        const MessageContextMenu = WebpackModules.getModule(
            (m) => m?.default?.displayName === "MessageContextMenu"
        );
        const SlateTextAreaContextMenu = WebpackModules.getModule(
            (m) => m?.default?.displayName === "SlateTextAreaContextMenu"
        );

        return class JishoLookup extends Plugin {
            async onStart() {
                this.settings = this.loadSettings({ maxDefinitions: 4 });

                BdApi.injectCSS(config.info.name, customCSS);

                Patcher.after(
                    config.info.name,
                    MessageContextMenu,
                    "default",
                    (_, __, ret) => {
                        ret.props.children.push(this.getContextMenuItem());
                    }
                );

                Patcher.after(
                    config.info.name,
                    SlateTextAreaContextMenu,
                    "default",
                    (_, __, ret) => {
                        ret.props.children.push(this.getContextMenuItem());
                    }
                );
            }
            getContextMenuItem() {
                let selection = window.getSelection().toString().trim();
                if (selection === "") {
                    return;
                }

                let ContextMenuItem = DCM.buildMenuItem({
                    label: "Jisho",
                    type: "text",
                    action: () => {
                        fetch(
                            `https://jisho.org/api/v1/search/words?keyword=${selection}`
                        )
                            .then((data) => {
                                return data.json();
                            })
                            .then((res) => {
                                this.processDefinitions(word, res);
                            });
                    },
                });
                return ContextMenuItem;
            }
            async processDefinitions(word, res) {
                if (res?.data?.length === 0) {
                    BdApi.alert(
                        "No definitons found!",
                        React.createElement(
                            "div",
                            { class: "markdown-11q6EU paragraph-3Ejjt0" },
                            `Couldn't find `,
                            React.createElement(
                                "span",
                                { style: { fontWeight: "bold" } },
                                `"${word}"`
                            ),
                            ` on Jisho.`
                        )
                    );
                    return;
                }

                let definitionElement = [];
                for (
                    let i = 0;
                    i < res.data.length && i < this.settings.maxDefinitions;
                    i++
                ) {
                    // Pick apart a specific definition
                    let definitionBlob = res.data[i];

                    // Get all english definitions, splice together with comma
                    let definition =
                        definitionBlob.senses[0].english_definitions.join(", ");

                    // Get JLPT level
                    let jlptLevel = definitionBlob.jlpt[0].replace("jlpt-", "");

                    // Get the readings
                    let readingsList = "";
                    definitionBlob.japanese.forEach((obj) => {
                        // Only match readings that are of the original word
                        if (obj.word == word) {
                            readingsList.push(obj.reading);
                        }
                    });
                    let readings = readingsList.join(", ");

                    // Get the part of speech
                    let partOfSpeech =
                        definitionBlob.senses[0].parts_of_speech[0];

                    // Create all react elements for this definition
                    definitionElement.push(
                        React.createElement(
                            "div",
                            { class: "Jisho-Definition" },
                            React.createElement(
                                "div",
                                { class: "Jisho-Title" },
                                "Definition:"
                            ),
                            React.createElement(
                                "div",
                                { class: "Jisho-Text" },
                                definition
                            ),
                            React.createElement(
                                "div",
                                { class: "Jisho-Title" },
                                "Reading:"
                            ),
                            React.createElement(
                                "div",
                                { class: "Jisho-Text" },
                                readings
                            ),
                            React.createElement(
                                "div",
                                { class: "Jisho-Info" },
                                "PoS: ",
                                React.createElement(
                                    "span",
                                    { class: "Jisho-PartOfSpeech" },
                                    partOfSpeech
                                ),
                                ", JLPT: ",
                                React.createElement(
                                    "span",
                                    { class: "Jisho-JLPT" },
                                    jlptLevel
                                )
                            )
                        )
                    );
                }

                BdApi.alert(
                    "",
                    React.createElement(
                        "div",
                        { class: "Jisho-Wrapper" },
                        React.createElement("a", {
                            href: "https://jisho.org/",
                            target: "_blank",
                        }),
                        React.createElement(
                            "a",
                            {
                                href: `https://jisho.org/search/${word}`,
                                target: "_blank",
                            },
                            React.createElement(
                                "div",
                                { class: "Jisho-Word" },
                                word
                            )
                        ),
                        definitionElement
                    )
                );
            }

            getSettingsPanel() {
                return SettingPanel.build(
                    () => this.saveSettings(this.settings),
                    new Slider(
                        "Amount of definitions",
                        "Defines how many definitions of the word you want to get displayed. More definitions will take longer to load (especially with the Profanity Filter turned on).",
                        1,
                        10,
                        this.settings.maxDefinitions,
                        (i) => {
                            this.settings.maxDefinitions = i;
                        },
                        {
                            markers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                            stickToMarkers: true,
                        }
                    )
                );
            }
            onStop() {
                BdApi.clearCSS(config.info.name);
                Patcher.unpatchAll(config.info.name);
            }
        };
    })(global.ZeresPluginLibrary.buildPlugin(config));
};

module.exports = !globalThis.ZeresPluginLibrary
    ? PluginLibDNE
    : PluginLibExists;
