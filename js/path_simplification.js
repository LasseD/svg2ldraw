var UTIL = {};

UTIL.PathSimplification = function(pointsPerCurve) {
    this.pointsPerCurve = pointsPerCurve;
}

/*
  Assumes a path like the following (see https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths ):

  <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">  
    <path d="M10 10 H 90 V 90 H 10 L 10 10"/>
  </svg>

  Returns a structured object with the simplified paths:
  {width, height
 */
UTIL.PathSimplification.prototype.handleSvg = function(svgAsText) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(svgAsText, "text/xml");
    var svg = doc.children[0];

    var svgObj = {width: Number(svg.attributes.width.value), 
                  height: Number(svg.attributes.height.value), 
                  paths: []};

    var paths = doc.getElementsByTagName('path');
    for(var i = 0; i < paths.length; i++) {
        var path = paths[i];
        var d = path.attributes.d.value;
        svgObj.paths.push(this.handlePathD(d));
    }

    return svgObj;
}

/*
  Handles the d-attribute (path content) of a path.
 */
UTIL.PathSimplification.prototype.handlePathD = function(d) {
    // TODO

    // var c = new UTIL.BezierRemover(pointsPerCurve).handleSvg(this.content);
    //c = UTIL.simplifySvgPaths(c); // TODO: Find the right way to do this.
    return d;
}



