function DispatchNode() {
  this.method = null;
  this.args = 0;
  this.children = {};
}

DispatchNode.prototype.compile = function(level, callParent) {
  var callMethod = callParent;

  if (this.method) {
    callMethod = 'this.' + this.method + '(';
    for (var i = 1; i < this.args; i++) {
      callMethod += 'exp['+(i + level - 1 )+'],';
    }
    callMethod += level === 0 ? 'exp' : 'exp.splice(' + level +')';
    callMethod += ')';
  }

  var code = 'switch(exp[' + level + ']) {';
  var empty = true;

  for(var key in this.children) {
    code += "\ncase '" + key +"':\n";
    code +=  this.children[key].compile(level + 1, callMethod) + ';';

    empty = false;
  }

  if (empty) {
    if (!this.method) {
      throw new Error('Invalid dispatcher node');
    }
    return 'return ' + callMethod;
  }

  code += '\ndefault:\n return ' + (callMethod || 'exp') + ';\n}';

  return code;
};


function Filter() { }
(function() {
  // Tools

  this.compactAndMap = function(items, callback) {
    var res = [];
    var i = items.length;
    while (i--) {
      var item = items[i];

      if (item != null) {
        res.push(callback(item));
      }
    }
    return res;
  };

  // Core

  this.on_multi = function(exps) {
    var multi = ['multi'];

    var i = exps.length;
    while (i--) {
      multi.push(this.compile(exps[i]));
    }

    return multi;
  };

  this.on_capture = function(name, exp) {
    return ['capture', name, this.compile(exp)];
  };

  // Control Flow

  this.on_if = function(condition, cases) {
    var self = this;
    return ['if', condition].concat(
      self.compactAndMap(cases, function(e) {
        return self.compile(e);
      })
    );
  };

  this.on_case = function(arg, cases) {
    var self = this;
    return ['case', arg].concat(
      self.compactAndMap(cases, function(condition, exp){
        return [condition, self.compile(exp)];
      })
    );
  };

  this.on_block = function(code, content) {
    return ['block', code, this.compile(content)];
  };

  this.on_cond = function(cases) {
    var res = ['cond'];

    for (var i = 0, cse; cse = cases[i]; i++) {
      res.push([cse[0], this.compile(cse[1])]);
    }

    return res;
  };

  // Escaping

  this.on_escape = function(flag, exp) {
    return ['escape', flag, this.compile(exp)];
  };

  // Dispatching

  this.exec = function(exp) {
    return this.compile(exp);
  };

  this.compile = function(exp) {
    return this.dispatcher(exp);
  };

  this.dispatcher = function(exp) {
    return this.replaceDispatcher(exp);
  };

  this.dispatchedMethods = function() {
    var methods = [];

    for (var key in this) {
      if (/^on(_[a-zA-Z0-9]+)*$/.test(key)) {
        methods.push(key);
      }
    }
    return methods;
  };

  this.replaceDispatcher = function(exp) {
    var tree = new DispatchNode;
    var dispatchedMethods = this.dispatchedMethods();
    for (var i = 0, method; method = dispatchedMethods[i]; i++) {
      var types = method.split(/_/).splice(1);
      var node = tree;
      for (var j = 0, type; type = types[j]; j++) {
        var n = node.children[type];
        node = node.children[type] = n || new DispatchNode;
      }
      node.args = this[method].length;
      node.method = method;
    }
    var code = '[function(exp) {\n' + tree.compile(0) + ';' + '}]';
    this.dispatcher = eval(code)[0];
    return this.dispatcher(exp);
  };

}).apply(Filter.prototype)

module.exports = Filter;