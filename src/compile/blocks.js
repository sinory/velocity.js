module.exports = function(Velocity, utils){
  /**
   * blocks语法处理
   */
  utils.mixin(Velocity.prototype, {
    /**
     * 处理代码库: if foreach macro
     */
    getBlock: function(block) {
      var ast = block[0];
      var ret = '';
      var _block = [ast];
      var _inBlock = [];
      var index = 0;
      var blockTypes = ['if', 'foreach', 'macro', 'noescape', 'define'];

      /**
       * 处理block嵌套，重新构造_block，把block中有嵌套的放入数组_inBlock,
       * _inBlock 最后成为_block的一个元素，_inBlock数组作为一个block数组，求值
       * 过程中，可以通过递归求值，进入下一层嵌套
       */
      utils.forEach(block, function(ast, i){
        if (i) {
          if (utils.indexOf(ast.type, blockTypes) !== -1) {
            index ++;
            _inBlock.push(ast);
          } else if (ast.type === 'end') {
            index --;
            if (index) {
              _inBlock.push(ast);
            } else {
              _block.push(_inBlock.slice());
              _inBlock = [];
            }
          } else {
            index ? _inBlock.push(ast) : _block.push(ast);
          }
        }
      });

      if (ast.type === 'if') {
        ret = this.getBlockIf(_block);
      } else if (ast.type === 'foreach') {
        ret = this.getBlockEach(_block);
      } else if (ast.type === 'macro') {
        this.setBlockMacro(_block);
      } else if (ast.type === 'noescape') {
        ret = this._render(_block.slice(1));
      }

      return ret || '';
    },

    /**
     * define macro
     */
    setBlockMacro: function(block){
      var ast = block[0];
      var _block = block.slice(1);
      var macros = this.macros;

      macros[ast.id] = {
        asts: _block,
        args: ast.args
      };
    },

    /**
     * parse macro call
     */
    getMacro: function(ast){
      var macro = this.macros[ast.id];
      var ret = '';

      if (!macro) {

        var jsmacros = this.jsmacros;
        macro = jsmacros[ast.id];
        var jsArgs = [];

        if (macro && macro.apply) {

          utils.forEach(ast.args, function(a){
            jsArgs.push(this.getLiteral(a));
          }, this);

          ret = macro.apply(this, jsArgs);

        }

      } else {
        var asts = macro.asts;
        var args = macro.args;
        var _call_args = ast.args;
        var local = {};
        var localKey = [];
        var guid = utils.guid();
        var contextId = ast.id + ':' + guid;

        utils.forEach(args, function(ref, i){
          if (_call_args[i]) {
            local[ref.id] = this.getLiteral(_call_args[i]);
          } else {
            local[ref.id] = undefined;
          }
        }, this);

        ret = this.eval(asts, local, contextId);
      }

      return ret;
    },

    /**
     * eval
     * @param str {array|string} 需要解析的字符串
     * @param local {object} 局部变量
     * @param contextId {string} 
     * @return {string}
     */
    eval: function(str, local, contextId){

      if (!local) {

        if (utils.isArray(str)) {
          return this._render(str);
        } else {
          return this.evalStr(str);
        }

      } else {

        var asts = [];
        var Parser = Velocity.Parser;
        contextId = contextId || ('eval:' + utils.guid());

        if (utils.isArray(str)) {

          asts = str;

        } else if (Parser) {

          asts = Parser.parse(str);

        }

        if (asts.length) {

          this.local[contextId] = local;
          var ret = this._render(asts, contextId);
          this.local[contextId] = {};
          this.conditions.pop();
          this.condition = '';

          return ret;
        }

      }

    },

    /**
     * parse #foreach
     */
    getBlockEach: function(block){

      var ast = block[0];
      var _from = this.getLiteral(ast.from);
      var _block = block.slice(1);
      var _to = ast.to;
      var local = {
        foreach: {
          count: 0
        }
      };
      var ret = '';
      var guid = utils.guid();
      var contextId = 'foreach:' + guid;

      var type = ({}).toString.call(_from);
      if (!_from || (type !== '[object Array]' && type !== '[object Object]')) return;

      var len = utils.isArray(_from)? _from.length: utils.keys(_from).length;

      utils.forEach(_from, function(val, i){

        if (this.setBreak) return;
        //构造临时变量
        local[_to] = val;
        //TODO: here, the foreach variable give to local, when _from is not an
        //array, count and hasNext would be undefined, also i is not the
        //index.
        local['foreach']['count'] = i + 1;
        local['foreach']['index'] = i;
        local['foreach']['hasNext'] = i + 1 < len;
        local['velocityCount'] = i + 1;
        this.local[contextId] = local;
        ret += this._render(_block, contextId);

      }, this);

      this.setBreak = false;
      //删除临时变量
      this.local[contextId] = {};
      this.conditions.pop();
      this.condition = '';

      return ret;

    },

    /**
     * parse #if
     */
    getBlockIf: function(block) {

      var str = '';
      var received = false;
      var asts = [];

      utils.some(block, function(ast){

        if (ast.condition) {

          if (received) return true;
          received = this.getExpression(ast.condition);

        } else if (ast.type === 'else') {
          if (received) return true;
          received = true;
        } else if (received) {
          asts.push(ast);
        }

        return false;

      }, this);

      return this._render(asts);
    }
  });
};
