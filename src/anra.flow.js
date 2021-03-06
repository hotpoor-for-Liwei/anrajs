/**
 * Created by Hasee on 2017/3/21.
 *
 * API for flow dialect，example:
 input=[
 {id:1, name:'CAPP', type:0,bounds:[100, 150, 40, 40]},
 {id:2, name:'MNPP', type:1, desc:'transaction',  bounds:[250, 100, 40, 40]},
 {id:3, name:'TMKS', type:1, desc:'handle exception',bounds:[250, 200, 40, 40]},
 {id:4, name:'CIVR', type:1, bounds:[430, 60, 40, 40]},
 {id:5, name:'CSRS', type:2, bounds:[430, 140, 40, 40]},
 {id:6, name:'CIVR', type:2, bounds:[430, 180, 40, 40]},
 {id:7, name:'CSRS', type:2, bounds:[430, 260, 40, 40]}]

 link=[
 {id:0,source:1,target:2,exit:0,entr:1},
 {id:1,source:1,target:2,exit:2,entr:1},
 {id:2,source:1,target:2,exit:3,entr:1}
 ]

 FlowEditor = function(config){
 }

 CommonEditPart = function(config){
 }

 SystemEditPart=new CommonEditPart({
    key:'id',
    children:null
 });


 editor = new FlowEditor({
            data:data,
            line:link,
            id:tagId,
            name:'EditorName',
            key:'id',
            children:{
                    0: SystemEditPart,
                    1: SegmentEditPart,
                    2: BalanceEditPart,
                    3: ContainerEditPart,
                    4: StartEditPart,
                    5: EndEditPart
            },
            command:{
                0:{
                name: 'undo',
                type: ACTION_STACK,
                key: 'ctrl+z',
                run: function () {
                    editor.cmdStack.undo();
                },
                check: function (node) {
                    return editor.cmdStack.canUndo();
                }
            }
            }
            },
 policies:{

            },
 paint:function(){
            }

 });
 */

/**
 * 对外的API
 * @type {{}}
 */
$AG = {
    CIRCLE: anra.svg.Circle,
    RECT: anra.svg.Rect,
    IMAGE: anra.svg.Image,
    TEXT: anra.svg.TEXT,
    LINE: anra.gef.Line,
    CURVE_LINE: anra.gef.CurveLine
};

$AG.Marker = {
    TRIANGLE: anra.svg.TriangleMarker
};

/**
 * 编辑器的API
 * @type {{}}
 */
$AG.Editor = anra.gef.Editor.extend({
    config: null,
    constructor: function (config) {
        this.config = config;
        this.setInput(config);
        this.createContent(config.id);
    },
    input2model: function (data, rootModel) {
        doInit.call(this, data, rootModel, this.config);
    },
    registActions: function () {
        if (this.config.canUndoAndRedo) {
            this.actionRegistry.regist([
                {
                    id: -1002,
                    type: ACTION_STACK,
                    key: 'ctrl+z',
                    run: function () {
                        this.stack.undo();
                    },
                    check: function () {
                        return this.stack.canUndo();
                    }
                }, {
                    id: -1001,
                    type: ACTION_STACK,
                    key: 'ctrl+y',
                    run: function () {
                        this.stack.redo();
                    },
                    check: function () {
                        return this.stack.canRedo();
                    }
                }
            ]);
        }
        this.config.operations && this.actionRegistry.regist(this.config.operations);
    },
    initRootEditPart: function (editPart) {
        editPart.config = this.config;
        editPart.addNotify();
    },
    addNode: function (data) {
        this.exec(new anra.gef.CreateNodeCommand(this.rootEditPart, $AG.Node.create(data)));
    },
    removeNode: function (node) {
        if (!(node instanceof anra.gef.NodeModel))
            node = this.find(node);
        if (node == null)
            throw 'can not find node';
        this.exec(new anra.gef.DeleteNodeAndLineCommand(this.rootEditPart, node));
    },
    addLine: function (data) {
        this.exec(new anra.gef.CreateLineCommand(this.rootEditPart, $AG.Line.create(data), data.source, data.target));
    },
    removeLine: function (line) {
        this.exec(new anra.gef.DeleteLineCommand(this.rootEditPart, line));
    },
    find: function (id) {
        var model = this.rootEditPart.model.getChild(id);
        return model == null ? null : this.rootEditPart.getEditPart(model);
    },
    exec: function (cmd) {
        if (this.cmdStack)
            this.cmdStack.execute(cmd);
    },
    undo: function () {
        if (this.cmdStack)
            this.cmdStack.undo();
    },
    redo: function () {
        if (this.cmdStack)
            this.cmdStack.redo();
    },
    canUndo: function () {
        if (this.cmdStack)
            this.cmdStack.canUndo();
    },
    canRedo: function () {
        if (this.cmdStack)
            this.cmdStack.canRedo();
    },
    createEditPart: function (parentControl, model) {
        var nodeConfig = this.config.children[model.props.type];
        if (nodeConfig == null)throw 'can not found EditPart config on node [' + model.props.type + ']';
        var e = new anra.gef.NodeEditPart();
        e.config = nodeConfig;
        e.refreshVisual = nodeConfig.refresh;

        if (nodeConfig.on) {
            e.installEditPolicy('on create figure', anra.gef.Policy.init({
                activate: function () {
                    var key;
                    for (key in nodeConfig.on) {
                        this.getHostFigure().on(key, nodeConfig.on[key]);
                    }
                },
                deactivate: function () {
                    var key;
                    for (key in nodeConfig.on) {
                        this.getHostFigure().off(key, nodeConfig.on[key]);
                    }
                }
            }));
        }
        if (nodeConfig.linkable) {
            e.installEditPolicy('CONNECTION_POLICY', new $AG.ConnectionPolicy());
        }

        if (nodeConfig.selectable) {
            var p = new anra.gef.ResizableEditPolicy();
            if (nodeConfig.selected)
                p.selected = nodeConfig.selected;
            if (nodeConfig.unselected)
                p.unselected = nodeConfig.unselected;
            e.installEditPolicy('selection', p);
            nodeConfig.onselect && e.addSelectionListener(nodeConfig.onselect);
        }

        if (nodeConfig.canDrag) {
            e.dragTracker = new anra.gef.DragTracker();
        }
        if (this.config.lines) {
            var lineConfigs = this.config.lines;

            e.createLineEditPart = function (model) {
                var l = new anra.gef.LineEditPart(model);
                l.config = lineConfigs[model.get('type')];

                if (l.config.selectable) {
                    l.installEditPolicy('line selection', new anra.gef.LineSelectionPolicy());
                }

                l.onCreateFigure = function (figure) {
                    figure.router = l.config.router;
                    figure.oncreated = function () {
                        if (l.config.startMarker) {
                            figure.setStartMarker(new l.config.startMarker.type(l.config.startMarker));
                        }
                        if (l.config.endMarker) {
                            figure.setEndMarker(new l.config.endMarker.type(l.config.endMarker));
                        }
                    }
                };
                return l;
            }
        }
        return e;
    },
    getCustomPolicies: function () {
        this.put(anra.gef.LAYOUT_POLICY, new anra.gef.LayoutPolicy());
    },
    setTool: function (toolConfig) {
        this.setActiveTool(anra.gef.Tool.init(toolConfig));
    }
});


/**
 * 从json生成NodeModel，目前只考虑了一层，以后可以改为递归
 * @param data
 * @param parentModel
 * @param config
 */
var doInit = function (input, parentModel, config) {
    var lineModel;
    var i;
    //节点处理
    if (input.data) {
        for (i = 0, len = input.data.length; i < len; i++) {
            parentModel.addChild($AG.Node.create(input.data[i]));
        }
    }
    //连线处理
    var lines = config.line;
    var line, source, target;
    if (lines)
        for (i = 0; i < lines.length; i++) {
            line = lines[i];
            lineModel = $AG.Line.create(line);
            source = parentModel.getChild(line.source);
            if (source == null)
                throw 'source of line[' + line.id + '] does not exist';
            target = parentModel.getChild(line.target);
            if (target == null)
                throw 'target of line[' + line.id + '] does not exist';

            source.addSourceLine(lineModel);
            target.addTargetLine(lineModel);
        }
};

/**
 * 控制器的API
 * @type {{}}
 */

$AG.EditPart = anra.gef.EditPart.extend({});


$AG.Node = anra.gef.NodeModel.extend({});

$AG.Line = anra.gef.LineModel.extend({});

$AG.Line.create = function (data) {
    var l = new $AG.Line();
    l.props = data;
    return l;
};

$AG.Node.create = function (data) {
    var n = new $AG.Node();
    n.props = data;
    return n;
};

$AG.ConnectionPolicy = anra.gef.ConnectionPolicy.extend({});

$AG.LineTool = anra.gef.LinkLineTool.extend({
    constructor: function (m) {
        var line = $AG.Line.create(m);
        anra.gef.LinkLineTool.prototype.constructor.call(this, line);
    }
});

$AG.policy = {
    TextPolicy: function (key, loc) {
        return {
            activate: function () {
                this.handle = new anra.gef.TextHandle(this.getHost());
                if (loc)
                    this.handle.refreshLocation = loc;
                this.handle.setText(this.getHost().model.get(key));
                this.getHandleLayer().addChild(this.handle);
            },
            deactivate: function () {
                this.getHandleLayer().removeChild(this.handle);
            }
        }
    }
};