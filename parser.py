import functools
import sys
import os, os.path
from io import open
import glob, time

from lark import Lark, UnexpectedInput, Tree, Token
from lark.indenter import Indenter

# __path__ = os.path.dirname(__file__)

class PythonIndenter(Indenter):
  NL_type = '_NEWLINE'
  OPEN_PAREN_types = ['LPAR', 'LSQB', 'LBRACE']
  CLOSE_PAREN_types = ['RPAR', 'RSQB', 'RBRACE']
  INDENT_type = '_INDENT'
  DEDENT_type = '_DEDENT'
  tab_len = 8

kwargs = dict(rel_to = __file__, postlex = PythonIndenter(), start = 'file_input')
global_context = {}
gd_parser = Lark.open('gd.lark', parser='lalr', **kwargs)

def _check_func_call(name, arguments):
  pass

def _check_attr(name):
  pass

def _extract_enum(acc, token):
  if token.type == 'NAME':
    acc.append(token.value)

  return acc

def _extract_assignation(children):
  if isinstance(children, list):
    children = children[0]

  if isinstance(children, type(None)):
    return None
  elif isinstance(children, Tree):
    if children.data == 'funccall':
      fc_name = None
      fc_arguments = []
      index = 0

      for child in children.children:
        if index == 0:
          fc_name = _extract_assignation(child)
        else:
          fc_arguments.append(_extract_assignation(child))
        index += 1

      _check_func_call(fc_name, fc_arguments)
      return fc_name
    elif children.data == 'list':
      return []
    elif children.data == 'dict':
      return {}
    elif children.data == 'getattr':
      _check_attr(children.children)
      return _extract_assignation(children.children[0])
    elif children.data == 'arguments' or children.data == 'string' \
      or children.data == 'number':
      return _extract_assignation(children.children[0])
  elif isinstance(children, Token):
    if children.type == 'STRING' or children.type == 'LONG_STRING' \
      or children.type == 'DEC_NUMBER' or children.type == 'HEX_NUMBER' \
      or children.type == 'OCT_NUMBER' or children.type == 'BIN_NUMBER' \
      or children.type == 'FLOAT_NUMBER' or children.type == 'IMAG_NUMBER' \
      or children.type == 'NULL_TOKEN':
      return children.value
    elif children.type == 'NAME':
      return children.value
  else:
    return children.value

  return -0

def _check_duplicate(item_type, item_context, item_name, global_context_path):
  items_to_check = ['var', 'const', 'enum', 'func', 'class']
  error_detected = False

  for context_key in items_to_check:
    if context_key in global_context and item_name in global_context[context_key]:
      error_detected = True
      break

  if not error_detected:
    relative_context = global_context

    for context_key in global_context_path:
      relative_context = relative_context[context_key]

      for sub_context_key in items_to_check:
        if sub_context_key in relative_context and item_name in relative_context[sub_context_key]:
          error_detected = True
          break

      if error_detected:
        break

  if error_detected:
    error_message = ('\'%s %s\' shadowing' % (item_type, item_name))
    _output_message('error', item_context.children[0], error_message)

def _extract_var(children):
  var_name_found = False
  var_name = ''
  remaining_children = None

  for child in children:
    if var_name_found:
      remaining_children = child
      break
    elif child.data == 'var':
      var_name = child.children[0].value
      var_name_found = True

  return var_name, remaining_children

def _add_item_to_context(_type, _context, _key, first_child, _context_path):
  if not _type in _context:
    _context[_type] = {}

  _check_duplicate(_type, first_child, _key, _context_path)

def assign_var(children, global_context_path):
  if isinstance(children[0], Token):
    if children[0].type == 'NAME':
      var_name = children[0].value
      var_ref = None
      items_to_check = ['var', 'const', 'enum', 'func', 'class']

      for context_key in items_to_check:
        if context_key in global_context and var_name in global_context[context_key]:
          var_ref = global_context[context_key]

      relative_context = global_context

      for context_key in global_context_path:
        relative_context = relative_context[context_key]

        for sub_context_key in items_to_check:
          if sub_context_key in relative_context and var_name in relative_context[sub_context_key]:
            var_ref = relative_context[sub_context_key]

      if var_ref == None:
        error_message = '\'%s %s\' not defined' % ('var', var_name)
        _output_message('error', children[0], error_message)
      else:
        var_ref[var_name] = _extract_assignation(children[1:])
  else:
    assign_var(children[0].children, global_context_path)

def _output_message(level, node, message):
  print('%s:%d:%d:%s' % (
    level,
    node.line,
    node.column,
    message
  ))

def analyze_tree(tree, context, context_path = []):
  for child in tree.children:
    if child.data == 'tool' or child.data == 'noop':
      continue
    elif child.data == 'suite' or child.data == 'compound_stmt' or child.data == 'return_stmt':
      analyze_tree(Tree(child.children[0].data, child.children), context, context_path)
    elif child.data == 'extenddef':

      context['extend'] = child.children[0].value
    elif child.data == 'enum':
      enum_name = child.children[0].value

      _add_item_to_context('enum', context, enum_name, child.children[0], context_path)
      context['enum'][enum_name] = functools.reduce(_extract_enum, child.children[1].children, [])
    elif child.data == 'const':
      const_name = child.children[0].value

      _add_item_to_context('const', context, const_name, child.children[0], context_path)
      context['const'][const_name] = _extract_assignation(child.children[1].children)
    elif child.data == 'var_stmt':
      var_name, assignation_data = _extract_var(child.children)

      _add_item_to_context('var', context, var_name, child.children[0], context_path)
      context['var'][var_name] = _extract_assignation(assignation_data)
    elif child.data == 'classdef':
      class_name = child.children[0].value

      _add_item_to_context('class', context, class_name, child.children[0], context_path)
      context['class'][class_name] = {}
      new_context_path = context_path + ['class', class_name]

      analyze_tree(Tree(class_name, child.children[1:]), context['class'][class_name], new_context_path)

    elif child.data == 'funcdef':
      func_name = child.children[0].value

      # Check that the func does not already exists
      _add_item_to_context('func', context, func_name, child.children[0], context_path)
      context['func'][func_name] = {}
      new_context_path = context_path + ['func', func_name]

      analyze_tree(Tree(func_name, child.children[1:]), context['func'][func_name], new_context_path)

    elif child.data == 'expr_stmt':
      assign_var(child.children, context_path)

    elif child.data == 'parameters':
      for subchild in child.children:
        varname = subchild
        varvalue = None

        if isinstance(subchild, Tree):
          varname = subchild.children[0].value
          varvalue = _extract_assignation(subchild.children[1:])
        else:
          varname = subchild.value

        _add_item_to_context('var', context, varname, child, context_path)
        context['var'][varname] = varvalue

    elif child.data == 'if_stmt':
      pass

    elif child.data == 'funccall':
      pass

    elif child.data == 'for_stmt':
      pass

    elif child.data == 'while_stmt':
      pass

    else:
      print(context_path)
      print(global_context)
      print(child.data)
      print(child.children)
      # exit(0)

def _read(fn, *args):
  kwargs = {
    'encoding': 'iso-8859-1'
  }

  with open(fn, *args, **kwargs) as f:
    return f.read()

def _get_lib_path():
  if os.name == 'nt':
    if 'PyPy' in sys.version:
      return os.path.join(sys.prefix, 'lib-python', sys.winver)
    else:
      return os.path.join(sys.prefix, 'Lib')
  else:
    return [x for x in sys.path if x.endswith('%s.%s' % sys.version_info[:2])][0]

if __name__ == '__main__':
  input_text = _read(sys.argv[1]) + '\n'

  try:
    parsed_file = gd_parser.parse(input_text)

    analyze_tree(parsed_file, global_context)
  except UnexpectedInput as error:
    print('%d:%d:%s' % (error.line, error.column, error.get_context(input_text)))
