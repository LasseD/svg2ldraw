'user strict';

/*
  PathSimplification simplifies SVG files. Simplified files consist only of path elements.
 */
UTIL.PathSimplification = function(pointsPerPixel, onWarning, onError) {
    this.pointsPerPixel = pointsPerPixel;
    this.onWarning = onWarning;
    this.onError = onError;

    this.bezierRemover = new UTIL.BezierRemover(pointsPerPixel);
    this.groups = {}; // id -> group
    this.styleClasses = {} // class name -> fill
    this.idToStyleClass = {}; // referencing id -> style class name

    this.nodeHandlers = {
        circle: this.handleSvgCircle,
        defs: this.handleSvgDefs,
        ellipse: this.handleSvgEllipse,
        g: this.handleSvgGroup,
        metadata: x => {}, // Ignore 'metadata' nodes.
        path: this.handleSvgPath,
        polygon: this.handleSvgPolygon,
        rect: this.handleSvgRect,
        style: this.handleStyle,
        linearGradient: this.handleLinearGradient
    };
}

UTIL.PathSimplification.prototype.addSimpleGroup = function(id, paths) {
    var g = new UTIL.Group();
    g.paths = paths;
    this.groups[id] = g;
}

UTIL.Group = function(transform) {
    this.refs = []; // [] -> {group,transform}
    this.paths = [];
    this.transform = transform || function(x){return x;};
}

UTIL.Group.prototype.output = function(outputPaths, transform) {
    var self = this;
    var t = function(p) {
        //console.log('group transform ' + p.x + ',' + p.y + ' -> ' + self.transform(p).x + ',' + self.transform(p).y);
        return transform(self.transform(p));
    };
    this.paths.forEach(path => outputPaths.push(new UTIL.Path(path.pts.map(p => t(p)), path.color)));
    this.refs.forEach(ref => ref.group.output(outputPaths, p => t(ref.transform(p))));
}

/*
  Assumes a path like the following (see https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths ):

  <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">  
    <path d="M10 10 H 90 V 90 H 10 L 10 10"/>
  </svg>

  Returns a structured object with the simplified paths:
  {width, height
 */
UTIL.PathSimplification.prototype.simplifySvg = function(svgAsText) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(svgAsText, "text/xml");
    var svg = doc.children[0];
    return this.simplifySvgDom(svg);
}

UTIL.PathSimplification.prototype.simplifySvgDom = function(svg) {
    console.log('simplifying for ' + this.pointsPerPixel + ' ppp');
    var a = svg.attributes;
    if(!a) {
        onError('Invalid SVG file: Missing attributes in svg node!');
        return; // Invalid SVG file.
    }

    var paths = [];
    for(var i = 0; i < svg.children.length; i++) {
        var child = svg.children[i];
        this.handleSvgNode(child, paths, '#000000', p => p);
    }

    var w, h, vb;
    if(a.width === undefined || a.height === undefined) {
        if(!a.viewBox) {
            onError('SVG missing viewBox and width/height!');
            return; // Invalid SVG file.
        }
        vb = a.viewBox.value.split(' ').map(x => parseFloat(x));
        w = 400; // Hard coded.
        h = w * vb[3] / vb[2]; // Scale to width.
    }
    else {
        w = parseFloat(a.width.value);
        h = parseFloat(a.height.value);        
    }

    if(a.viewBox) {
        vb = vb || a.viewBox.value.split(' ').map(x => parseFloat(x));
        var dx = scaleW = w / vb[2];
        var dy = scaleH = h / vb[3];
        
        var applyViewBox = function(p) {
            p.x = (p.x-vb[0])*scaleW;
            p.y = (p.y-vb[1])*scaleH;
        }
        paths.forEach(path => path.pts.forEach(applyViewBox));
    }
    
    var svgObj = {width: w, height: h, viewBox:{x:0,y:0,width:w,height:h}, paths:paths};
    return svgObj;
}

UTIL.PathSimplification.prototype.handleSvgNode = function(node, output, fill, transformation) {
    // Fill color: 'style' takes precedence over 'fill'. Both overwrite inherited value.
    var a = node.attributes;
    if(a) {
        if(node.attributes['class']) {
            var className = node.attributes['class'].value;
            if(this.styleClasses.hasOwnProperty(className)) {
                fill = this.styleClasses[className];
            }
        }
        if(node.attributes.fill) {
            fill = node.attributes.fill.value;
        }
        if(node.attributes.style) {
            var style = node.attributes.style.value;
            var fillMatches = style.match(/(?:fill\:\s*)([\w\#]+)\;?/);
            if(fillMatches) {
                fill = fillMatches[1];
            }
        }
        if(fill === 'none') {
            this.onWarning('fill_none', 'fill:none; is not yet supported. SVG elements with this property will be ignored.');
            return;
        }
    }

    if(this.nodeHandlers.hasOwnProperty(node.nodeName)) {
        //console.log('Handling element of type ' + node.nodeName);
        var f = this.nodeHandlers[node.nodeName];
        f.call(this, node, output, fill, transformation);
    }
    else {
        this.onWarning(node.nodeName, 'Unsupported SVG element type: ' + node.nodeName + '. This element will be ignored.');
    }
}

UTIL.PathSimplification.prototype.getTransformation = function(txt, baseTransformation) {
    if(txt.startsWith('matrix(')) {
        const a = txt.substring(7).split(/[\,\s]+/).map(x => parseFloat(x));
        return function(p) {
            var x = p.x*a[0] + p.y*a[2] + a[4];
            var y = p.x*a[1] + p.y*a[3] + a[5];
            return baseTransformation(new UTIL.Point(x, y));
        };
    }
    else if(txt.startsWith('translate(')) {
        const a = txt.substring(10).split(/[\,\s]+/).map(x => parseFloat(x));
        return function(p) {
            var x = p.x+a[0];
            var y = p.y+a[1];
            return baseTransformation(new UTIL.Point(x, y));
        };
    }
    else if(txt.startsWith('scale(')) {
        const a = txt.substring(10).split(/[\,\s]+/).map(x => parseFloat(x));
        return function(p) {
            var x = p.x*a[0];
            var y = p.y*a[1];
            return baseTransformation(new UTIL.Point(x, y));
        };
    }
    else {
        this.onWarning(txt, 'Unsupported transformation "' + txt + '". SVG groups with this type of transformation will be ignored.');
        return baseTransformation;
    }
}

UTIL.PathSimplification.prototype.handleStyle = function(g, outputPaths, fill, transformation) {
    var content = g.innerHTML;
    var match;
    var re = /\.([a-zA-Z0-9\_]+)\{fill\:\s*(\#[0-9a-fA-F]+)\;/g;
    while(match = re.exec(content)) {
        var className = match[1];
        var fill = match[2];
        this.styleClasses[className] = fill;
    }

    //    re = /\.([a-zA-Z0-9\_]+)\{fill\:\s*url\(\#([0-9a-fA-F\_]+)\)/g;
    re = /\.([a-zA-Z0-9\_]+)\{fill\:url\(\#([0-9a-zA-Z\_]+)\)/g;
    while(match = re.exec(content)) {
        var className = match[1];
        var url = match[2];
        this.idToStyleClass[url] = className;
    }
}

UTIL.PathSimplification.prototype.handleLinearGradient = function(g, outputPaths, fill, transformation) {
    var id = g.id;
    if(!id) {
        this.onWarning('linearGradientID', 'LinearGradient element without ID will be ignored.');
        return;
    }
    var styleClassName = this.idToStyleClass[id];
    if(!styleClassName) {
        this.onWarning(styleClassName, 'Unknown style class name: "' + styleClassName + '". Skipping linearGradient element.');
        return;
    }

    for(var i = 0; i < g.children.length; i++) {
        var child = g.children[i];
        if(child.nodeName === 'stop') {
            var childA = child.attributes;
            var childStyle = childA['style'];
            if(!childStyle) {
                this.onWarning('lg_style', 'Missing style attribute in linearGradient stop element. Element will be ignored.');
                continue;
            }
            childStyle = childStyle.value;
            if(childStyle.length !== 18) {
                this.onWarning('lg_color', 'Expecting stop style of length 18. Element will be ignored.');
                continue;
            }
            var c = childStyle.substring(11); // Expect value like 'stop-color:#05102E'
            this.styleClasses[styleClassName] = c;
            break; // No read to set the value multiple times.
        }
    }
    // TODO: Proper handling of gradients.
}

UTIL.PathSimplification.prototype.handleSvgGroup = function(g, outputPaths, fill, transformation) {
    var a = g.attributes;
    var groupTransformation = transformation;
    if(a.transform) {
        groupTransformation = this.getTransformation(a.transform.value, transformation);
    }
    var group = new UTIL.Group(groupTransformation);
    var overloadedOutputPaths = {};
    overloadedOutputPaths.push = function(outputPath) {
        outputPaths.push(outputPath);
        group.paths.push(outputPath);
    }
    for(var i = 0; i < g.children.length; i++) {
        var child = g.children[i];
        if(child.nodeName === 'use') {
            var childA = child.attributes;
            var ref = childA['xlink:href'];
            if(!ref) {
                this.onWarning('xlink:href', 'Missing xlink:href attribute in "use" element. Output for this will be skipped.');
                continue;
            }
            ref = ref.value.substring(1);
            if(!this.groups.hasOwnProperty(ref)) {
                this.onWarning(ref, 'Unknown ID: "' + ref + '". Skipping "use" element.');
                continue;
            }
            ref = this.groups[ref];

            // Transform:
            const x = childA.x ? parseFloat(childA.x.value) : 0;
            const y = childA.y ? parseFloat(childA.y.value) : 0;
            var childT = function(p) {
                return groupTransformation(new UTIL.Point(p.x+x, p.y+y));
            };

            group.refs.push({group:ref, transform:childT});
            ref.output(outputPaths, p => childT(p));
        }
        else {
            this.handleSvgNode(child, overloadedOutputPaths, fill, groupTransformation);
        }
    }
    if(a.id) {
        this.groups[a.id.value] = group;
    }
}

UTIL.PathSimplification.prototype.handleSvgDefs = function(g, outputPaths, fill, transformation) {
    var a = g.attributes;
    if(!a.id) {
        this.onWarning('defs', 'defs element without ID has no effect and will be ignored.');
        return;
    }
    var groupTransformation = transformation;
    if(a.transform) {
        groupTransformation = this.getTransformation(a.transform.value, transformation);
    }
    var group = new UTIL.Group(groupTransformation);

    for(var i = 0; i < g.children.length; i++) {
        var child = g.children[i];
        if(child.nodeName === 'use') {
            var childA = child.attributes;
            var ref = childA['xlink:href'];
            if(!ref) {
                this.onWarning('xlink:href', 'Missing xlink:href attribute in "use" element. Output for this will be skipped.');
                continue;
            }
            ref = ref.value.substring(1);
            if(!this.groups.hasOwnProperty(ref)) {
                this.onWarning(ref, 'Unknown ID: "' + ref + '". Skipping "use" element.');
                continue;
            }
            ref = this.groups[ref];

            // Transform:
            const x = childA.x ? parseFloat(childA.x.value) : 0;
            const y = childA.y ? parseFloat(childA.y.value) : 0;
            var childT = function(p) {
                return groupTransformation(new UTIL.Point(p.x+x, p.y+y));
            };

            group.refs.push({group:ref, transform:childT});
        }
        else {
            this.handleSvgNode(child, group.paths, fill, groupTransformation);
        }
    }
    this.groups[a.id.value] = group;
}

UTIL.PathSimplification.prototype.handleSvgRect = function(rect, outputPaths, color, transformation) {
    var a = rect.attributes;
    var x = a.x ? parseFloat(a.x.value) : 0;
    var y = a.y ? parseFloat(a.y.value) : 0;
    var w = parseFloat(a.width.value);
    var h = parseFloat(a.height.value);

    var points = [new UTIL.Point(x,y), new UTIL.Point(x+w,y),
                  new UTIL.Point(x+w,y+h), new UTIL.Point(x,y+h)].map(transformation);
    outputPaths.push(new UTIL.Path(points, color));
    if(a.id)
        this.addSimpleGroup(a.id.value, [points]);
}

UTIL.PathSimplification.prototype.handleSvgPolygon = function(poly, outputPaths, color, transformation) {
    const a = poly.attributes;
    const pts = a.points;
    if(!pts) {
        this.onWarning('polygon_missing_points', 'Polygon is missing its "points" attribute and cannot be drawn.');
        return;
    }
    const coordinates = pts.value.split(/[\,\s]+/).map(x => parseFloat(x));

    var points = [];
    for(var i = 0; i < coordinates.length-1; i+=2) {
        var x = coordinates[i];
        var y = coordinates[i+1];
        points.push(new UTIL.Point(x, y));
    }
    points = points.map(transformation);

    outputPaths.push(new UTIL.Path(points, color));
    if(a.id)
        this.addSimpleGroup(a.id.value, [points]);
}

UTIL.PathSimplification.prototype.handleSvgCircle = function(c, outputPaths, color, transformation) {
    var a = c.attributes;
    var cx = a.cx ? parseFloat(a.cx.value) : 0;
    var cy = a.cy ? parseFloat(a.cy.value) : 0;
    var r = parseFloat(a.r.value);

    var points = [];
    var pointsPerCircle = Math.max(3, Math.floor(this.pointsPerPixel * Math.PI * 2 * r));
    for(var i = 0; i < pointsPerCircle; i++) {
        var angle = Math.PI*2*i/pointsPerCircle;
        points.push(new UTIL.Point(cx+Math.cos(angle)*r, cy+Math.sin(angle)*r));
    }

    points = points.map(transformation);
    outputPaths.push(new UTIL.Path(points, color));
    if(a.id) {
        this.addSimpleGroup(a.id.value, [points]);
    }
}

UTIL.PathSimplification.prototype.handleSvgEllipse = function(e, outputPaths, color, transformation) {
    var a = e.attributes;
    var cx = a.cx ? parseFloat(a.cx.value) : 0;
    var cy = a.cy ? parseFloat(a.cy.value) : 0;
    var rx = parseFloat(a.rx.value);
    var ry = parseFloat(a.ry.value);

    var points = [];
    var pointsPerCircle = Math.max(3, Math.floor(this.pointsPerPixel * Math.PI * (rx+ry))); // At least 3 points.
    for(var i = 0; i < pointsPerCircle; i++) {
        var angle = Math.PI*2*i/pointsPerCircle;
        points.push(new UTIL.Point(cx+Math.cos(angle)*rx, cy+Math.sin(angle)*ry));
    }

    points = points.map(transformation);
    outputPaths.push(new UTIL.Path(points, color));
    if(a.id) {
        this.addSimpleGroup(a.id.value, [points]);
    }
}

UTIL.PathSimplification.prototype.svgObjToSvg = function(svgObj) {
    var ret = '<svg width="' + svgObj.width + '" height="' + svgObj.height + '"';
    ret += ' viewBox="' + svgObj.viewBox.x + ' ' + svgObj.viewBox.y + ' ' + svgObj.viewBox.width + ' ' + svgObj.viewBox.height + '"';
    ret += ' xmlns="http://www.w3.org/2000/svg">\n';

    function shorten(x) {
        if(x === Math.floor(x))
          return x;
        return x.toFixed(3);
    }

    svgObj.paths.forEach(function(path) {
            var p = path.pts;
            ret += '  <path d="M ' + shorten(p[0].x) + ' ' + shorten(p[0].y) + ' ';

            for(var j = 1; j < p.length; j++) {
                var x = shorten(p[j].x);
                var y = shorten(p[j].y);
                ret += 'L ' + x + ' ' + y + ' ';
            }
            ret += 'Z" fill="' + path.color +'"/>\n';
        });

    /*
    svgObj.paths.forEach(function(path) {
            ret += '\n';
            path.pts.forEach(function(p) {
                    var x = shorten(p.x);
                    var y = shorten(p.y);
                    ret += '  <circle cx="' + x + '" cy="' + y + '" r="3" fill="none" stroke="black" />\n';
                });
        });//*/

    ret += '</svg>';
    return ret;
}

/*
  Handles the d-attribute (path content) of a path.
  Assumptions:
  - First command of any subpath is 'M' or 'm'.
  - Each path ends with is 'Z', 'z' or 'L x0 y0' where x0, y0 is the position of the first M or m command.
  - A path doesn't self-intersect, not have overlapping positions (except the two path end points).
 */
UTIL.PathSimplification.prototype.handleSvgPath = function(path, outputPaths, color, transformation) {
    var a = path.attributes;
    var d = a.d.value;
    var tokens = d.match(/[a-zA-Z]+|\-?[0-9]*\.?[0-9]+/gi);
    var x = 0, y = 0; // Current position.
    var p = []; // Current path.

    var group;
    if(a.id) {
        group = new UTIL.Group();
    }

    function closePath() {
        if(p && p.length >= 3) {
            var path = new UTIL.Path(p, color);
            outputPaths.push(path);
            if(group) {
                group.paths.push(path);
            }
        }
        p = [];
    }

    function push() {
        if(p.length > 0) {
            var first = p[0];
            var last = p[p.length-1];
            if(first.x === x && first.y === y) {
                return;
            }
            if(last.x === x && last.y === y) {
                return;
            }
        }        
        p.push(transformation(new UTIL.Point(x,y)));
    }

    var x0, y0, x1, y1, x2, y2, x3, y3, p0, p1, p2, p3;
    var cmd = 'M', prevCmd = 'M';
    for(var i = 0; i < tokens.length; i++) {
	x0 = x, y0 = y;
	if(tokens[i].match(/[a-zA-Z]/i)) {
            cmd = tokens[i]; // Update cmd.
	}
	else {
	    i--;
	}

        switch(cmd) {
        case 'M': // Move to absolute
            x = y = 0;
        case 'm': // Move to relative
	    cmd = (cmd === 'M' ? 'L' : 'l'); // Line-to commands are implicit after move
            closePath();
            x += Number(tokens[++i]);
            y += Number(tokens[++i]);
            push();
            break;
        case 'Z': // End 
        case 'z': // End
            if(p.length !== 0) {
		closePath();
	    }
            break;
        case 'L': // Line to absolute
            x = y = 0;
        case 'l': // Line to relative
            x = x+Number(tokens[++i]);
            y = y+Number(tokens[++i]);
            if(x === p[0].x && y === p[0].y) {
                closePath();
                push();
            }
            push();
            break;
        case 'H': // Line to horizontal absolute
            x = 0;
        case 'h': // Line to horizontal relative
            x = x+Number(tokens[++i]);
            if(x === p[0].x && y === p[0].y) {
                closePath();
                push();
            }
            push();
            break;
        case 'V': // Line to vertical absolute
            y = 0;
        case 'v': // Line to vertical relative
            y = y+Number(tokens[++i]);
            if(x === p[0].x && y === p[0].y) {
                closePath();
                push();
            }
            push();
            break;
        case 'C': // Bezier curve absolute
	    x = y = 0;
        case 'c': // Bezier curve relative
            x1 = x+Number(tokens[++i]);
            y1 = y+Number(tokens[++i]);
            x2 = x+Number(tokens[++i]);
            y2 = y+Number(tokens[++i]);
            x3 = x+Number(tokens[++i]);
            y3 = y+Number(tokens[++i]);
            var curvePoints = this.bezierRemover.handleCurve(x0, y0, x1, y1, x2, y2, x3, y3);
            for(var k = 0; k < curvePoints.length; k++) {
                x = curvePoints[k].x;
                y = curvePoints[k].y;
                push();
            }
            x = x3;
            y = y3;
            if(x === p[0].x && y === p[0].y) {
                closePath();
                push();
            }
            break;
        case 'S': // Short Bezier curve absolute
	    x = y = 0;
        case 's': // Short Bezier curve relative
            if(prevCmd === 's' || prevCmd === 'S' || prevCmd === 'C' || prevCmd === 'c') {
                x1 = x3 + (x3-x2);
                y1 = y3 + (y3-y2);
            }
            else {
                x1 = x0; y1 = y0;
            }
            x2 = x+Number(tokens[++i]);
            y2 = y+Number(tokens[++i]);
            x3 = x+Number(tokens[++i]);
            y3 = y+Number(tokens[++i]);
            var curvePoints = this.bezierRemover.handleCurve(x0, y0, x1, y1, x2, y2, x3, y3);
            for(var k = 0; k < curvePoints.length; k++) {
                x = curvePoints[k].x;
                y = curvePoints[k].y;
                push();
            }
            x = x3;
            y = y3;
            if(x === p[0].x && y === p[0].y) {
                closePath();
                push();
            }
            break;
        default:
            this.onWarning(cmd, 'Unsupported path command "' + cmd + '". The path will be skipped.');
            return;
        }
        prevCmd = cmd;
    }
    closePath();

    if(group) {
        this.groups[a.id.value] = group;
    }
}
