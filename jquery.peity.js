// Peity jQuery plugin version 1.2.1
// (c) 2013 Ben Pickles
//
// http://benpickles.github.io/peity
//
// Released under MIT license.
(function($, document, Math) {
  var canvasSupported = document.createElement("canvas").getContext

  var peity = $.fn.peity = function(type, options) {
    if (canvasSupported) {
      this.each(function() {
        var $this = $(this)
        var chart = $this.data("peity")

        if (chart) {
          if (type) chart.type = type
          $.extend(chart.opts, options)
          chart.draw()
        } else {
          var defaults = peity.defaults[type]
          var data = {}

          $.each($this.data(), function(name, value) {
            if (name in defaults) data[name] = value
          })

          var opts = $.extend({}, defaults, data, options)
          var chart = new Peity($this, type, opts)
          chart.draw()

          $this
            .change(function() { chart.draw() })
            .data("peity", chart)
        }
      });
    }

    return this;
  };

  var svgElement = function(name, attrs) {
    var elem = document.createElementNS("http://www.w3.org/2000/svg", name)

    $.each(attrs, function(attr, value) {
      elem.setAttribute(attr, value)
    })

    return elem
  }

  var Peity = function($el, type, opts) {
    this.$el = $el
    this.type = type
    this.opts = opts
  }

  var PeityPrototype = Peity.prototype

  PeityPrototype.draw = function() {
    peity.graphers[this.type].call(this, this.opts)
  }

  PeityPrototype.fill = function() {
    var fill = this.opts.fill
    var func = fill

    if (!$.isFunction(func)) {
      func = function(_, i) {
        return fill[i % fill.length]
      }
    }

    return func
  }

  PeityPrototype.prepareSVG = function(width, height) {
    if (this.svg) {
      $(this.svg).empty()
    } else {
      this.svg = svgElement("svg", {
        "class": "peity"
      })

      this.$el.hide().after(this.svg)

      $(this.svg).data("peity", this)
    }

    this.svg.setAttribute("height", height)
    this.svg.setAttribute("width", width)
  }

  PeityPrototype.values = function() {
    return $.map(this.$el.text().split(this.opts.delimiter), function(value) {
      return parseFloat(value)
    })
  }

  peity.defaults = {}
  peity.graphers = {}

  peity.register = function(type, defaults, grapher) {
    this.defaults[type] = defaults
    this.graphers[type] = grapher
  }

  peity.register(
    'pie',
    {
      delimiter: null,
      diameter: 16,
      fill: ["#ff9900", "#fff4dd", "#ffc66e"]
    },
    function(opts) {
      if (!opts.delimiter) {
        var delimiter = this.$el.text().match(/[^0-9\.]/)
        opts.delimiter = delimiter ? delimiter[0] : ","
      }

      var values = this.values()

      if (opts.delimiter == "/") {
        var v1 = values[0]
        var v2 = values[1]
        values = [v1, v2 - v1]
      }

      var i = 0
      var length = values.length
      var sum = 0

      for (; i < length; i++) {
        sum += values[i]
      }

      var width = opts.width || opts.diameter
        , height = opts.height || opts.diameter

      this.prepareSVG(width, height)

      var radius = Math.min(width, height) / 2
      var pi = Math.PI
      var fill = this.fill()
      var start = -pi / 2

      for (i = 0; i < length; i++) {
        var value = values[i]
          , portion = value / sum
          , node

        if (portion == 1) {
          node = svgElement("circle", {
            cx: radius,
            cy: radius,
            r: radius
          })
        } else {
          var slice = portion * pi * 2
            , end = start + slice
            , x1 = radius * Math.cos(start) + radius
            , y1 = radius * Math.sin(start) + radius
            , x2 = radius * Math.cos(end) + radius
            , y2 = radius * Math.sin(end) + radius

          var d = [
            "M", radius, radius,
            "L", x1, y1,
            "A", radius, radius, 0, slice > pi ? 1 : 0, 1, x2, y2,
            "Z"
          ]

          node = svgElement("path", {
            d: d.join(" ")
          })

          start = end
        }

        node.setAttribute("fill", fill.call(this, value, i, values))

        this.svg.appendChild(node)
      }
    }
  )

  peity.register(
    "line",
    {
      delimiter: ",",
      fill: "#c6d9fd",
      height: 16,
      max: null,
      min: 0,
      stroke: "#4d89f9",
      strokeWidth: 1,
      width: 32
    },
    function(opts) {
      var values = this.values()
      if (values.length == 1) values.push(values[0])
      var max = Math.max.apply(Math, values.concat([opts.max]));
      var min = Math.min.apply(Math, values.concat([opts.min]))

      var width = opts.width
        , height = opts.height

      this.prepareSVG(width, height)

      var xQuotient = width / (values.length - 1)
        , yQuotient = height / (max - min)
        , zero = height + (min * yQuotient)
        , coords = [0, zero]

      for (var i = 0; i < values.length; i++) {
        var x = i * xQuotient
          , y = height - (yQuotient * (values[i] - min))

        coords.push(x, y)
      }

      coords.push(width, zero)

      var polygon = svgElement("polygon", {
        fill: opts.fill,
        points: coords.join(" ")
      })

      this.svg.appendChild(polygon)

      if (opts.strokeWidth) {
        var polyline = svgElement("polyline", {
          fill: "transparent",
          points: coords.slice(2, coords.length - 2).join(" "),
          stroke: opts.stroke,
          "stroke-width": opts.strokeWidth,
          "stroke-linecap": "square"
        })

        this.svg.appendChild(polyline)
      }
    }
  );

  peity.register(
    'bar',
    {
      delimiter: ",",
      fill: ["#4D89F9"],
      height: 16,
      max: null,
      min: 0,
      spacing: window.devicePixelRatio || 1,
      width: 32
    },
    function(opts) {
      var values = this.values()
      var max = Math.max.apply(Math, values.concat([opts.max]));
      var min = Math.min.apply(Math, values.concat([opts.min]))

      var width = opts.width
        , height = opts.height

      this.prepareSVG(width, height)

      var yQuotient = height / (max - min)
      var space = opts.spacing
      var xQuotient = (width + space) / values.length
      var fill = this.fill()

      for (var i = 0; i < values.length; i++) {
        var value = values[i]
        var y = height - (yQuotient * (value - min))
        var h

        if (value == 0) {
          if (min >= 0 || max > 0) y -= 1
          h = 1
        } else {
          h = yQuotient * value
        }

        if (h < 0) {
          y += h
          h = -h
        }

        var rect = document.createElementNS("http://www.w3.org/2000/svg", "rect")
        rect.setAttribute("fill", fill.call(this, value, i, values))
        rect.setAttribute("x", i * xQuotient)
        rect.setAttribute("y", y)
        rect.setAttribute("width", xQuotient - space)
        rect.setAttribute("height", h)

        this.svg.appendChild(rect)
      }
    }
  );
})(jQuery, document, Math);
