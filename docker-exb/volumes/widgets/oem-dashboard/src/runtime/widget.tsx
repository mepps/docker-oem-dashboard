import './Widget.scss';
import React, {Component} from "react";
import {type AllWidgetProps} from "jimu-core";
import {JimuMapViewComponent, JimuMapView} from "jimu-arcgis";
import {Loading} from "jimu-ui";
import FeatureLayer from "esri/layers/FeatureLayer";
import Layer from "esri/layers/Layer"
import Basemap from "esri/Basemap";
import {addFeatures} from '@esri/arcgis-rest-feature-layer';
import OAuthInfo from "esri/identity/OAuthInfo";
import esriId from "esri/identity/IdentityManager";
import Template from "./Template";
import Category from "./Category";
import LayerComponent from "./LayerComponent/LayerComponent"
import SaveTemplateComponent from './SaveTemplateComponent'
import LayerListComponent from "./LayerListComponent/LayerListComponent";
import TemplateComponent from "./TemplateComponent/TemplateComponent";
import LayerWrapper from "./LayerWrapper";

interface WidgetState {
    jimuMapView: JimuMapView // JimuMapView of the linked Map
    layerWrappers: Map<number, LayerWrapper> // Map of Layer ID to LayerWrapper
    templates: Map<number, Template> // Map of Template ID to Template
    categories: Map<number, Category> // Map of Category ID to Category
    loading: boolean // whether the application is still loading data
    activeTemplates: Template[] // list of active Templates
    activeLayers: LayerWrapper[] // list of active Layers
}

class Widget extends Component<AllWidgetProps<any>, WidgetState> {

    constructor(props: any) {
        super(props);
        this.state = {
            jimuMapView: undefined,
            layerWrappers: new Map<number, LayerWrapper>(),
            templates: new Map<number, Template>(),
            categories: new Map<number, Category>(),
            loading: true,
            activeTemplates: [],
            activeLayers: []
        }
    }

    private templateTable: FeatureLayer;
    private layerTable: FeatureLayer;
    private categoryTable: FeatureLayer;
    private templateLayerRelationships: FeatureLayer;

    async componentDidMount() {
        try {
            this.templateTable = new FeatureLayer({url: this.props.config.templateTableUrl});
            this.layerTable = new FeatureLayer({url: this.props.config.layerTableUrl});
            this.categoryTable = new FeatureLayer({url: this.props.config.categoryTableUrl});
            this.templateLayerRelationships = new FeatureLayer({url: this.props.config.templateLayerRelationshipsUrl});
        } catch (e) {
            // Stop execution of further methods because other functionalities unlikely to work if app failed
            // to connect to one or more tables.
            console.error(e);
            alert("Error connecting to database, please try again!");
            return;
        }
        try {
            await this.fetchCategories();
        } catch (e) {
            console.error(e);
            alert("Error loading categories, please try again!");
            return;
        }
        try {
            await this.fetchTemplates();
        } catch (e) {
            console.error(e);
            alert("Error loading templates, please try again!");
            return;
        }
        try {
            await this.fetchLayers();
        } catch (e) {
            console.error(e);
            alert("Error loading layers, please try again!");
            return;
        }
        try {
            await this.fetchTemplateLayers();
        } catch (e) {
            console.error(e);
            alert("Error loading template layers, please try again!");
            return;
        }
    }

    /**
     * Queries Categories table to create a Map of Category ID to Category and updates state
     */
    fetchCategories = async () => {
        // Query Categories Table
        let featureSet = await this.categoryTable.queryFeatures({
            where: "1=1",
            outFields: ["*"],
            orderByFields: ["TITLE"]
        });

        // Create Categories
        let newCategories: Map<number, Category> = new Map<number, Category>();
        for (let f of featureSet.features) {
            newCategories.set(f.attributes.OBJECTID, {
                id: f.attributes.OBJECTID,
                title: f.attributes.TITLE,
                layerWrappers: []
            });
        }

        this.setState({
            categories: newCategories
        })
    }

    /**
     * Queries Templates table to create list of Templates and updates state
     */
    fetchTemplates = async () => {
        // Query Templates table
        let featureSet = await this.templateTable.queryFeatures({
            where: "1=1",
            outFields: ["*"],
            orderByFields: ["TITLE"]
        });

        // Create Templates
        let newTemplates: Map<number, Template> = new Map<number, Template>();
        for (let f of featureSet.features) {
            newTemplates.set(f.attributes.OBJECTID, {
                id: f.attributes.OBJECTID,
                title: f.attributes.TITLE,
                layerWrappers: []
            })
        }

        this.setState({
            templates: newTemplates
        });
    }

    /**
     * Queries Layers table to create a Map of Layer ID to LayerWrapper and updates state.
     * Deletes LayerWrapper and its references if Layer creation fails.
     */
    fetchLayers = async () => {
        // Query Layers table
        let featureSet = await this.layerTable.queryFeatures({
            where: "1=1",
            outFields: ["OBJECTID", "TITLE", "URL", "SCOPE", "CATEGORYID", "RENDERER", "FILTER"],
            orderByFields: ["SCOPE", "TITLE"]
        });

        // Create LayerWrappers
        let newLayerWrappers: Map<number, LayerWrapper> = new Map<number, LayerWrapper>();
        for (let feature of featureSet.features) {
            let newLayerWrapper = {
                id: feature.attributes.OBJECTID,
                title: feature.attributes.SCOPE + " " + feature.attributes.TITLE,
                url: feature.attributes.URL,
                filter: feature.attributes.FILTER,
                renderer: feature.attributes.RENDERER,
                layer: null,
                category: this.state.categories.get(feature.attributes.CATEGORYID),
                templates: []
            };

            try {
                // Don't await createLayer to allow Layers to be loaded asynchronously in the background
                this.createLayer(newLayerWrapper);
                newLayerWrappers.set(feature.attributes.OBJECTID, newLayerWrapper);
                this.state.categories.get(feature.attributes.CATEGORYID).layerWrappers.push(newLayerWrapper);
            } catch (e) {
                console.error(e);
                alert(e.message);
            }
        }
        this.setState({
            layerWrappers: newLayerWrappers
        });
    }

    /**
     * Queries Template-Layer Relationships table and updates state
     */
    fetchTemplateLayers = async () => {
        // Order by OBJECTID to maintain Layer order
        let featureSet = await this.templateLayerRelationships.queryFeatures({
            where: "1=1",
            outFields: ["*"],
            orderByFields: ["OBJECTID"]
        });

        for (let feature of featureSet.features) {
            let layerWrapper = this.state.layerWrappers.get(feature.attributes.LAYERID);
            if (layerWrapper) {
                let template = this.state.templates.get(feature.attributes.TEMPLATEID);
                template.layerWrappers.push(layerWrapper);
                this.state.layerWrappers.get(feature.attributes.LAYERID).templates.push(template);
            }
        }

        this.setState({
            templates: this.state.templates,
            loading: false
        });
    }

    /**
     * Creates and returns a new Layer with the information from the given LayerWrapper.
     * @param layerWrapper the LayerWrapper from which to create the Layer
     * @throws Error if Layer creation fails
     */
    createLayer = async (layerWrapper: LayerWrapper) => {
        try {
            let newLayer: Layer = await Layer.fromArcGISServerUrl({url: layerWrapper.url});
            newLayer.id = layerWrapper.id.toString();
            newLayer.title = layerWrapper.title;

            // Custom Renderer
            if (newLayer.type === "feature") {
                if (layerWrapper.renderer != null) {
                    try {
                        (newLayer as FeatureLayer).renderer = JSON.parse(layerWrapper.renderer);
                    } catch (e) {
                        console.log("Error loading renderer for layer " + layerWrapper.title);
                        console.error(e);
                    }
                }
                if (layerWrapper.filter != null) {
                    try {
                        (newLayer as FeatureLayer).definitionExpression = layerWrapper.filter;
                    } catch (e) {
                        console.log("Error loading SQL filter for layer " + layerWrapper.title);
                        console.error(e);
                    }
                }
            }

            layerWrapper.layer = newLayer;
            return newLayer;
        } catch (e) {
            console.error(e);
            throw new Error("Error loading layer" + layerWrapper.title + "!");
        }
    }

    /**
     * Saves all active Layers as a new Template with the given title
     * @param title the title of the new Template
     */
    saveTemplate = async (title: string) => {
        try {
            if (title) {
                let sameTitle = await this.templateTable.queryFeatureCount({
                    where: "TITLE = '" + title + "'",
                    outFields: ["*"]
                }) > 0;

                if (sameTitle) {
                    alert("Error, a template with this title already exists!");
                } else {
                    let token = await this.getToken();

                    let response = await addFeatures({
                        url: this.props.config.templateTableUrl,
                        features: [{attributes: {
                                TITLE: title
                            }}],
                        params: {token: token}
                    });

                    if (!response.addResults[0].success) {
                        // @ts-ignore: per ArcGIS Rest JS API, IEditFeatureResult will contain an error
                        // message if success is false
                        throw new Error(response.addResults[0].error);
                    }
                    let templateId = response.addResults[0].objectId;
                    await this.saveTemplateLayers(templateId, token);
                    await this.fetchTemplates();
                    await this.fetchTemplateLayers();
                    alert("Successfully saved new event!");
                }
            } else {
                alert("Error, please enter a title!");
            }
        } catch (e) {
            console.error(e);
            alert("Error saving template, please try again!");
        }
    }

    /**
     * Adds Template-Layer relationships to Template Layer Relationships table
     * @param templateId the OBJECTID of the new Template
     * @param token the token to use to authenticate the network request
     */
    saveTemplateLayers = async (templateId: number, token: string) => {
        let features: any[] = [];
        let layers = this.state.jimuMapView.view.map.allLayers;

        for (let layer of layers) {
            // Eliminate non-operational Layers like base Layers
            if (this.state.layerWrappers.has(+layer.id)) {
                features.push({
                    attributes: {
                        TEMPLATEID: templateId,
                        LAYERID: layer.id
                    }
                });
            }
        }

        let response = await addFeatures({
            url: this.props.config.templateLayerRelationshipsUrl,
            features: features,
            params: {
                token: token
            }
        });

        if (!response.addResults[0].success) {
            // @ts-ignore: per ArcGIS Rest JS API, IEditFeatureResult will contain an error
            // message if success is false
            throw new Error(response.addResults[0].error);
        }
    }

    /**
     * Returns a token using user-provided login info that can be used to access ArcGIS services
     * @return a token generated using the user-provided Credential info
     */
    getToken = async () => {
        const info = new OAuthInfo({
            appId: "eS2vUdIZbHaVOrDz",
            flowType: "auto",
            popup: false
        });
        esriId.registerOAuthInfos([info]);

        let credential = await esriId.checkSignInStatus(info.portalUrl + "/sharing");
        if (!credential) {
            credential = await esriId.getCredential(info.portalUrl + "/sharing");
        }
        return credential.token;
    }

    /**
     * Adds the given Layer to the Map and list of active Layers
     * @param layerWrapper the Layer to add
     */
    addActiveLayer = async (layerWrapper: LayerWrapper) => {
        if (!layerWrapper.layer) {
            await this.createLayer(layerWrapper);
        }
        if (!this.state.activeLayers.includes(layerWrapper)) {
            let newActiveLayers = this.state.activeLayers.slice();
            newActiveLayers.push(layerWrapper);
            layerWrapper.layer.visible = true;
            try {
                this.state.jimuMapView.view.map.add(layerWrapper.layer);
            } catch (e) {
                alert("Error adding layer " + layerWrapper.title + "!");
            }
            this.setState({
                activeLayers: newActiveLayers
            });
        }
    }

    /**
     * Add the given Template to the Map and list of active Templates
     * @param template the Template to add
     */
    addActiveTemplate = async (template: Template) => {
        let newActiveTemplates = this.state.activeTemplates.slice();
        let newActiveLayers = this.state.activeLayers.slice();
        if (!newActiveTemplates.includes(template)) {
            newActiveTemplates.push(template);
        }

        for (let layerWrapper of template.layerWrappers) {
            if (!layerWrapper.layer) {
                await this.createLayer(layerWrapper);
            }
            if (!newActiveLayers.includes(layerWrapper)) {
                newActiveLayers.push(layerWrapper);
                layerWrapper.layer.visible = true;
                try {
                    this.state.jimuMapView.view.map.add(layerWrapper.layer);
                } catch (e) {
                    alert("Error adding layer " + layerWrapper.title + "!");
                }
            }
        }

        this.setState({
            activeTemplates: newActiveTemplates,
            activeLayers: newActiveLayers
        });
    }

    /**
     * Removes the given Layer from the Map and list of active Layers. Removes any Templates without associated
     * active Layers after the given Layer has been removed.
     * @param layer the Layer to remove
     */
    removeActiveLayer = (layer: Layer) => {
        let newActiveLayers = this.state.activeLayers.filter((lw) => {return lw.layer !== layer});
        let newActiveTemplates = this.state.activeTemplates;
        this.state.jimuMapView.view.map.remove(layer);

        // Check if any active Templates need to be removed
        for (let activeTemplate of newActiveTemplates) {
            if (this.state.layerWrappers.get(+layer.id).templates.includes(activeTemplate)) {
                let active: boolean = false;
                for (let layerWrapper of activeTemplate.layerWrappers) {
                    if (newActiveLayers.includes(layerWrapper)) {
                        active = true;
                        break;
                    }
                }
                if (!active) {
                    newActiveTemplates = newActiveTemplates.filter((t) => {return t !== activeTemplate});
                }
            }
        }

        this.setState({
            activeTemplates: newActiveTemplates,
            activeLayers: newActiveLayers
        });
    }

    /**
     * Removes the given Template from the Map and list of active Templates. Removes any Templates without associated
     * active Layers after the given Template has been removed.
     * @param removeTemplate the Template to remove
     */
    removeActiveTemplate = (removeTemplate: Template) => {
        let newActiveLayers = this.state.activeLayers.slice();
        let newActiveTemplates = this.state.activeTemplates.filter((t) => t !== removeTemplate);

        for (let layerWrapper of removeTemplate.layerWrappers) {
            // Don't remove layer if it belongs to another active Template
            let active: boolean = false;
            for (let activeTemplate of newActiveTemplates) {
                if (layerWrapper.templates.includes(activeTemplate)) {
                    active = true;
                    break;
                }
            }
            if (!active) {
                newActiveLayers = newActiveLayers.filter((lw) => lw !== layerWrapper);
                this.state.jimuMapView.view.map.remove(layerWrapper.layer);
            }
        }

        this.setState({
            activeTemplates: newActiveTemplates,
            activeLayers: newActiveLayers
        });
    }

    /**
     * Handles clear all action
     */
    clearAll = () => {
        this.state.jimuMapView.view.map.removeAll();
        this.setState({
            activeTemplates: [],
            activeLayers: []
        })
    }

    /**
     * Returns a list of Templates that the given Layer belongs to
     * @param layer the Layer to check
     * @param active set to true to only return active Templates
     * @return a list of Templates that the given Layer belongs to
     */
    getLayerTemplates = (layer: Layer, active?: boolean) => {
        if (!this.state.layerWrappers.get(+layer.id)) {
            return [];
        }
        if (active) {
            let activeTemplates = [];
            for (let template of this.state.layerWrappers.get(+layer.id).templates) {
                if (this.state.activeTemplates.includes(template)) {
                    activeTemplates.push(template);
                }
            }
            return activeTemplates;
        } else {
            return this.state.layerWrappers.get(+layer.id).templates;
        }
    }

    /**
     * Returns the Category that the given Layer belongs to
     * @param layer the Layer to check
     * @return the Category that the given Layer belongs to
     */
    getLayerCategory = (layer: Layer) => {
        if (!this.state.layerWrappers.get(+layer.id)) {
            return null;
        }
        return this.state.layerWrappers.get(+layer.id).category;
    }

    /**
     * Queries Layer Table and returns information about the given Layer
     * @param layer the Layer to query information about
     * @return a JSON object containing the source, description, and url of the layer or
     * only the url of the layer if the network request fails
     */
    getLayerInfo = async (layer: Layer) => {
        try {
            if (!this.state.layerWrappers.get(+layer.id)) {
                return null;
            }

            let featureSet = await this.layerTable.queryFeatures({
                where: "OBJECTID = " + layer.id,
                outFields: ["SOURCE", "DESCRIPTION"]
            });

            if (featureSet.features.length > 0) {
                return {
                    source: featureSet.features[0].attributes.SOURCE,
                    description: featureSet.features[0].attributes.DESCRIPTION,
                    url: this.state.layerWrappers.get(+layer.id).url
                }
            } else {
                throw new Error("No layers found with the given OBJECTID!");
            }
        } catch (e) {
            alert("Error loading layer info!");
            console.error(e);
            return {
                source: "Error",
                description: "Error",
                url: this.state.layerWrappers.get(+layer.id).url
            }
        }
    }

    /**
     * Updates state to given JimuMapView and sets initial basemap
     * @param jmv the new JimuMapView
     */
    activeViewChangeHandler = (jmv: JimuMapView) => {
        if (jmv) {
            if (!this.state.jimuMapView) {
                // Set basemap on first active view change
                jmv.view.map.basemap = Basemap.fromId("arcgis-topographic");
            }
            this.setState({
                jimuMapView: jmv
            });
        }
    }

    render() {
        return (
            <div className="widget-starter jimu-widget">
                {
                    this.props.useMapWidgetIds &&
                    this.props.useMapWidgetIds.length === 1 && (
                        <JimuMapViewComponent
                            useMapWidgetId={this.props.useMapWidgetIds?.[0]}
                            onActiveViewChange={this.activeViewChangeHandler}
                        />
                    )
                }
                <div id="oem-dashboard-grid">
                    <div
                        id="template-component__grid-item"
                        className="grid-item"
                    >
                        <h3>Add Layers</h3>
                        <TemplateComponent
                            templates={Array.from(this.state.templates.values())}
                            activeTemplates={this.state.activeTemplates}
                            onAddTemplate={this.addActiveTemplate}
                            onRemoveTemplate={this.removeActiveTemplate}
                            activeLayers={this.state.activeLayers}
                            onAddLayer={this.addActiveLayer}
                        />
                    </div>
                    <div
                        id="layer-component__grid-item"
                        className="grid-item"
                    >
                        {
                            this.state.loading && (
                                <Loading type="SECONDARY" />
                            )
                        }
                        <LayerComponent
                            layers={Array.from(this.state.layerWrappers.values())}
                            categories={Array.from(this.state.categories.values())}
                            activeLayers={this.state.activeLayers}
                            onAddLayer={this.addActiveLayer}
                        />
                    </div>
                    <div
                        id="layer-list__grid-item"
                        className="grid-item"
                    >
                        {
                            !(
                                this.props.useMapWidgetIds &&
                                this.props.useMapWidgetIds.length === 1
                            ) && (
                                <Loading type="SECONDARY" />
                            )
                        }
                        {
                            this.props.useMapWidgetIds &&
                            this.props.useMapWidgetIds.length === 1 && (
                                <LayerListComponent
                                    useMapWidgetId={this.props.useMapWidgetIds?.[0]}
                                    onClearAll={this.clearAll}
                                    onRemoveLayer={this.removeActiveLayer}
                                    getLayerTemplates={this.getLayerTemplates}
                                    getLayerCategory={this.getLayerCategory}
                                    numActiveLayers={this.state.activeLayers.length}
                                    getLayerInfo={this.getLayerInfo}
                                />
                            )
                        }
                    </div>
                    <div id="save-template-grid-item" className="grid-item">
                        <SaveTemplateComponent
                            handleClick={this.saveTemplate}
                            show={this.state.activeLayers.length > 0}
                        />
                    </div>
                </div>
            </div>
        );
    }
}

export default Widget;
