/**
 * This maintains the User interface Tabs for app,
 * e.g. selected tab, any handling of open tab requests etc.
 */

import * as ui from "../../ui";
import * as React from "react";
import * as ReactDOM from "react-dom";

import * as tab from "./tab";
import * as tabRegistry from "./tabRegistry";
import {Code} from "../codeTab";
import {DependencyView} from "../dependencyView";
import * as commands from "../../commands/commands";
import * as utils from "../../../common/utils";
import csx = require('csx');
import {createId} from "../../../common/utils";
import * as constants from "../../../common/constants";

import * as types from "../../../common/types";
import {connect} from "react-redux";
import * as styles from "../../styles/styles";
import {Tips} from "./../tips";
import {Icon} from "../../icon";
import {cast, server} from "../../../socket/socketClient";
import * as alertOnLeave from "../../utils/alertOnLeave";
import {getSessionId, setSessionId} from "../clientSession";

/**
 * Singleton + tab state migrated from redux to the local component
 * This is because the component isn't very react friendly
 */
declare var _helpMeGrabTheType: AppTabsContainer;
export let tabState: typeof _helpMeGrabTheType.tabState;

export interface TabInstance {
    id: string;
    url: string;
    saved: boolean,
}

/**
 *
 * Golden layout
 *
 */
import * as GoldenLayout from "golden-layout";
require('golden-layout/src/css/goldenlayout-base.css');
require('golden-layout/src/css/goldenlayout-dark-theme.css');
/** Golden layout wants react / react-dom to be global */
(window as any).React = React;
(window as any).ReactDOM = ReactDOM;
/** Golden layout injects this prop into all react components */
interface GLProps extends React.Props<any>{
    /** https://golden-layout.com/docs/Container.html */
    glContainer: {
        setTitle:(title:string)=>any;
    }
}

/** Some additional styles */
require('./appTabsContainer.css')


export interface Props {
}

export interface State {
}

export class AppTabsContainer extends ui.BaseComponent<Props, State>{

    /** The Golden Layout */
    layout: GoldenLayout;

    constructor(props: Props) {
        super(props);

        /** Setup the singleton */
        tabState = this.tabState;
    }

    componentDidMount() {
        var config = {
            content: [{
                type: 'row',
                content: [
                    {
                        type: 'react-component',
                        component: 'example',
                        title: 'first',
                        props: {
                            text: 'pink'
                        }
                    },
                    {
                        type: 'react-component',
                        component: 'example',
                        title: 'second',
                        props: {
                            text: 'aqua'
                        }
                    },
                    {
                        type: 'react-component',
                        component: 'example',
                        title: 'third',
                        props: {
                            text: 'lightgreen'
                        }
                    }
                ]
            }]
        };

        this.layout = new GoldenLayout(config, this.ctrls.root);

        /**
         * Register all the tab components with layout
         */
        tabRegistry.getTabConfigs().forEach(({protocol,config}) => {
            this.layout.registerComponent(protocol, config.component);
        });

        this.layout.registerComponent('example', class Foo extends ui.BaseComponent<{text:string} & GLProps,{}>{
            constructor(props){
                super(props);
            }
            render(){
                return <div style={{width:'100%',height:'100%',backgroundColor:this.props.text}}>{this.props.text}</div>
            }
        });

        this.layout.init();


        /** Restore any open tabs from last session */
        server.getOpenUITabs({ sessionId: getSessionId() }).then((res) => {
            setSessionId(res.sessionId);

            if (!res.openTabs.length) return;

            let openTabs = res.openTabs;
            let tabInstances: TabInstance[] = openTabs.map(t => {
                return {
                    id: createId(),
                    url: t.url,
                    saved: true
                };
            });

            tabState.addTabs(tabInstances);
            // TODO: tab
            // tabState.selectTab(tabInstances.length - 1);
            // this.focusAndUpdateStuffWeKnowAboutCurrentTab();
        });
    }

    ctrls: {
        root?: HTMLDivElement
    } = {}

    render() {
        return (
            <div ref={root => this.ctrls.root = root} style={csx.extend(csx.vertical, csx.flex, { maxWidth: '100%' }) } className="app-tabs">
            </div>
        );
    }

    /**
     * Tab State
     */
    tabs: TabInstance[] = [];
    selectedTabIndex: number = NoSelectedTab;
    tabState = {
        addTabs: (tabs: TabInstance[]) => {
            this.tabs = tabs;
            // TODO: tab
        },
        selectTab: (index: number) => {
            this.selectedTabIndex = index;
            // TODO: tab
        }
    }
}

const NoSelectedTab = -1;
