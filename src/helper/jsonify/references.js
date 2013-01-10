module.exports = function(Velocity, utils){

  utils.mixin(Velocity.prototype, {

    //获取变量类型
    //TODO: foreach嵌套处理
    getRefType: function(ast){

      var local = this.getLocal(ast);
      var real = local.real || ast;
      var ret = { ignore: false, type: null, real: real, foreach: false };
      var m = this.hasMethod(real);
      var eachTo;

      if (local.type == 'foreach') {

        if (ast.id == local.ast.to) {
          ret.real = local.ast;
          ret.foreach = true;
        }

        eachTo = ast.id;
      }

      if (m === 'ignore') {
        ret.ignore = true;
      } else if (m) {
        ret.foreach = this.hasParamInForeach(real);
        ret.type = 'method';
      } else {
        ret.type = 'strings';
      }

      return ret;

    },

    hasParamInForeach: function(ast){

      var args = ast.args;
      var ret = false;

      if (args === undefined && ast.path) {
        args = ast.path[ast.path.length - 1].args;
      }

      if (args) {

        utils.some(args, function(a){
          var local = this.getLocal(a);
          if (local.type === 'foreach') {
            ret = local.ast; 
            return true;
          }
        }, this);

      }

      return ret;
    },

    /**
     * @param ast references ast
     * @return {true|false|'ignore'} true:pass, false:no method, ignore:ignore
     */
    hasMethod: function(ast){

      var ret = false;

      ret = ast.args !== undefined;

      var path = ast.path;

      if (path) {
        var len = path.length;
        var methods = utils.filter(path, function(a){
          return a.type === 'method';
        });

        //连缀方式$foo().bar()或者函数在中间的情况$foo().bar，跳过
        if ((+ret + methods.length) !== 1 || path[len - 1].type !== 'method') {
          ret = 'ignore';
        } else if (ret === false) {
          ret = true;
        }
      }

      return ret;

    },

    getReferences: function(ast, spyData, context){

      var astType = this.getRefType(ast);

      var real = astType.real;
      var text = this.getRefText(real);

      //执行过一遍，不再执行
      if (this.cache[text]) return;

      console.log(astType);

      utils.forEach(ast.path, function(property, i){

      }, this);

      this.cache[text] = true;

    },

    getLocal: function(ref){

      var ret = { context: this.context.strings, isGlobal: true };

      utils.some(this.conditions, function(content){

        var local = this.local[content];
        var index = local.variable.indexOf(ref.id);

        if (index > -1) {
          ret = local;
          ret['isGlobal'] = false;
          ret['real'] = ret.maps? ret.maps[index]: ref;
          return true;
        }

      }, this);

      if (ret.type === 'macro' && ret.real) {
        //递归查找上层
        var _local  = this.getLocal(ret.real);
        if (_local.isGlobal === false && _local.real) {
          ret.real = _local.real;
        }
      }

      return ret;
    }
  });
};