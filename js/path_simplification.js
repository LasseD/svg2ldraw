'user strict';

/*
  PathSimplification simplifies SVG files. Simplified files consist only of path elements.
 */
UTIL.PathSimplification = function(pointsPerPixel) {
    this.pointsPerPixel = pointsPerPixel;
    this.bezierRemover = new UTIL.BezierRemover(pointsPerPixel);
    this.groups = {}; // id -> group
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
    this.paths.forEach(path => outputPaths.push({points:path.points.map(p => t(p)), color:path.color}));
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
    var a = svg.attributes;
    if(!a || (a.width === undefined) || (a.height === undefined)) {
        console.warn('Invalid SVG file: Missing attributes!');
        return; // Invalid SVG file.
    }

    var w = Number(a.width.value);
    var h = Number(a.height.value);
    var transformation = function(p){return p;};
    
    var svgObj = {width: w, height: h, paths: []};
    svg.childNodes.forEach(x => this.handleSvgNode(x, svgObj.paths, '#000000', transformation));

    if(a.viewBox) {
        var vb = a.viewBox.value.split(' ').map(x => parseFloat(x));
        var dx = vb[2]-vb[0], scaleW = w/dx;
        var dy = vb[3]-vb[1], scaleH = h/dy;

        var applyViewBox = function(p) {
            p.x = p.x*scaleW - vb[0];
            p.y = p.y*scaleH - vb[1];
        }
        svgObj.paths.forEach(path => path.points.forEach(applyViewBox));
    }

    return svgObj;
}

UTIL.PathSimplification.prototype.handleSvgNode = function(node, output, fill, transformation) {
    // Fill color: 'style' takes precedence over 'fill'. Both overwrite inherited value.
    var a = node.attributes;
    if(a) {
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
    }

    if(node.nodeName == 'g') {
        this.handleSvgGroup(node, output, fill, transformation);
    }
    else if(node.nodeName == 'path') {
        this.handleSvgPath(node, output, fill, transformation);
    }
    else if(node.nodeName == 'rect') {
        this.handleSvgRect(node, output, fill, transformation);
    }
    else if(node.nodeName == 'circle') {
        this.handleSvgCircle(node, output, fill, transformation);
    }
}

UTIL.PathSimplification.prototype.handleSvgGroup = function(g, outputPaths, fill, transformation) {
    var a = g.attributes;
    var groupTransformation = transformation;
    if(a.transform) {
        var tVal = a.transform.value;
        if(!tVal.startsWith('matrix('))
            throw 'Unsupported transformation type: ' + tVal;
        var a = tVal.substring(7).split(',').map(x => parseFloat(x));
        groupTransformation = function(p) {
            var x = p.x*a[0] + p.y*a[2] + a[4];
            var y = p.x*a[1] + p.y*a[3] + a[5];
            return transformation(new UTIL.Point(x, y));
        }
    }
    var group = new UTIL.Group(groupTransformation);
    var overloadedOutputPaths = {};
    overloadedOutputPaths.push = function(outputPath) {
        outputPaths.push(outputPath);
        group.paths.push(outputPath);
    }
    for(var i = 0; i < g.childNodes.length; i++) {
        var child = g.childNodes[i];
        if(child.nodeName == 'use') {
            var childA = child.attributes;
            var ref = childA['xlink:href'];
            if(!ref) {
                console.warn("Missing xlink:href attribute in 'use' node. Skipping.");
                continue;
            }
            ref = ref.value.substring(1);
            if(!this.groups.hasOwnProperty(ref)) {
                console.warn("Unknown ID: '" + ref + "'. Skipping.");
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
            ref.output(outputPaths, p => childT(p)); // ERROR: viewBox transform is applied twice
        }
        else {
            this.handleSvgNode(child, overloadedOutputPaths, fill, groupTransformation);
        }
    }
    if(a.id) {
        this.groups[a.id.value] = group;
    }
}

UTIL.PathSimplification.prototype.handleSvgRect = function(rect, outputPaths, color, transformation) {
    var a = rect.attributes;
    var x = a.x ? parseFloat(a.x.value) : 0;
    var y = a.y ? parseFloat(a.y.value) : 0;
    var w = parseFloat(a.width.value);
    var h = parseFloat(a.height.value);

    var points = [new UTIL.Point(x,y), new UTIL.Point(x+w,y),
                  new UTIL.Point(x+w,y+h), new UTIL.Point(x,y+h)].map(transformation);
    outputPaths.push({points:points, color:color});
    if(a.id)
        this.addSimpleGroup(a.id.value, [points]);
}

UTIL.PathSimplification.prototype.handleSvgCircle = function(rect, outputPaths, color, transformation) {
    var a = rect.attributes;
    var cx = a.cx ? parseFloat(a.cx.value) : 0;
    var cy = a.cy ? parseFloat(a.cy.value) : 0;
    var r = parseFloat(a.r.value);

    var points = [];
    var pointsPerCircle = Math.floor(this.pointsPerPixel * Math.PI * 2 * r);
    //console.log(pointsPerCircle);
    for(var i = 0; i < pointsPerCircle; i++) {
        var angle = Math.PI*2*i/pointsPerCircle;
        points.push(new UTIL.Point(cx+Math.cos(angle)*r, cy+Math.sin(angle)*r));
    }

    points = points.map(transformation);
    outputPaths.push({points:points, color:color});
    if(a.id)
        this.addSimpleGroup(a.id.value, [points]);
}

UTIL.PathSimplification.prototype.decompositionToSvg = function(w, h, decomposition) {
    var svg = {width:w, height:h, paths:decomposition.trapezoids};
    return this.svgObjToSvg(svg);
}

UTIL.PathSimplification.prototype.svgObjToSvg = function(svgObj) {
    var ret = '<svg width="' + svgObj.width + '" height="' + svgObj.height + '" xmlns="http://www.w3.org/2000/svg">\n';

    function shorten(x) {
        if(x == Math.floor(x))
          return x;
        return x.toFixed(3);
    }

    for(var i = 0; i < svgObj.paths.length; i++) {
        var path = svgObj.paths[i];
        var p = path.points;
        ret += '  <path d="M ' + shorten(p[0].x) + ' ' + shorten(p[0].y) + ' ';

        for(var j = 1; j < p.length; j++) {
            var x = shorten(p[j].x);
            var y = shorten(p[j].y);
            ret += 'L ' + x + ' ' + y + ' ';
        }
        ret += 'Z" fill="' + path.color +'"/>\n';
    }
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
    var tokens = d.match(/[a-zA-Z]+|[0-9\.\-]+/gi);
    var x = 0, y = 0; // Current position.
    var p = []; // Current path.

    var group;
    if(a.id)
        group = new UTIL.Group();

    function closePath() {
        if(p && p.length >= 3) {
            var path = {points:p, color:color};
            outputPaths.push(path);
            group.paths.push(path);
        }
        p = [];
    }

    function push() {
        if(p.length > 0) {
            var first = p[0];
            var last = p[p.length-1];
            if(first.x == x && first.y == y)
                return;
            if(last.x == x && last.y == y)
                return;
        }
        p.push(transformation(new UTIL.Point(x,y)));
    }

    for(var i = 0; i < tokens.length; i++) {
        var cmd = tokens[i];
        switch(cmd) {
        case 'M':
            x = y = 0;
        case 'm':
            closePath();
            x = x+Number(tokens[++i]);
            y = y+Number(tokens[++i]);
            push();
            break;
        case 'Z':
        case 'z':
            if(p.length == 0)
                break;
            x = p[0].x;
            y = p[0].y;
            closePath();
            break;
        case 'L':
            x = y = 0;
        case 'l':
            x = x+Number(tokens[++i]);
            y = y+Number(tokens[++i]);
            if(x == p[0].x && y == p[0].y)
                closePath();
            push();
            break;
        case 'H':
            x = 0;
        case 'h':
            x = x+Number(tokens[++i]);
            if(x == p[0].x && y == p[0].y)
                closePath();
            push();
            break;
        case 'V':
            y = 0;
        case 'v':
            y = y+Number(tokens[++i]);
            if(x == p[0].x && y == p[0].y)
                closePath();
            push();
            break;
        case 'C':
            var x1 = Number(tokens[++i]);
            var y1 = Number(tokens[++i]);
            var x2 = Number(tokens[++i]);
            var y2 = Number(tokens[++i]);
            var x3 = Number(tokens[++i]);
            var y3 = Number(tokens[++i]);
            var p0 = new UTIL.Point(x, y);
            var p1 = new UTIL.Point(x1, y1);
            var p2 = new UTIL.Point(x2, y2);
            var p3 = new UTIL.Point(x3, y3);
            var curvePoints = this.bezierRemover.handleCurve(p0, p1, p2, p3);
            for(var k = 0; k < curvePoints.length; k++) {
                x = curvePoints[k].x;
                y = curvePoints[k].y;
                push();
            }
            x = x3;
            y = y3;
            if(x == p[0].x && y == p[0].y)
                closePath();
            break;
        case 'c':
            throw "Cubic bezier curve with additive coordinates not yet supported.";
        default: // Apparently the default behaviour is to assume 'L' when no command is given:
            x = Number(tokens[i]);
            y = Number(tokens[++i]);
            if(x == p[0].x && y == p[0].y)
                closePath();
            push();
            break;
        }
    }

    if(group) {
        this.groups[a.id.value] = group;
    }
}
