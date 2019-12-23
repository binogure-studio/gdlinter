#!/usr/bin/python3
import json
import functools
import getopt, sys
import os, os.path
from io import open
import glob, time

import godot_loader
from lark import Lark, UnexpectedInput, Tree, Token
from lark.indenter import Indenter

__real_file__ = os.path.realpath(__file__)
__path__ = os.path.dirname(__real_file__)

debug_mode = False
global_context = godot_loader.get_context()
_attributes_to_check = []

class GDScriptIndenter(Indenter):
  NL_type = '_NEWLINE'
  OPEN_PAREN_types = ['LPAR', 'LSQB', 'LBRACE']
  CLOSE_PAREN_types = ['RPAR', 'RSQB', 'RBRACE']
  INDENT_type = '_INDENT'
  DEDENT_type = '_DEDENT'
  tab_len = 2

def _get_context(var_name, global_context_path = [], items_to_check = ['var', 'const', 'enum', 'func', 'class', 'signal']):
  extended_classes = [global_context['extend']] if 'extend' in global_context else []

  for context_key in items_to_check:
    if context_key in global_context and var_name in global_context[context_key]:
      return context_key, global_context

  relative_context = global_context

  for context_key in global_context_path:
    relative_context = relative_context[context_key]

    if 'extends' in relative_context:
      extended_classes.append(relative_context['extends'])

    for sub_context_key in items_to_check:
      if sub_context_key in relative_context and var_name in relative_context[sub_context_key]:
        return sub_context_key, relative_context

  while len(extended_classes) > 0:
    extended_class = extended_classes[0]
    extended_classes = extended_classes[1:]

    if var_name != extended_class:
      local_key, local_context = _get_context(extended_class, [], ['class'])

      if local_key == None:
        extended_class = 'CanvasItem'
        local_key, local_context = _get_context('CanvasItem', [], ['class'])

      local_context = local_context[local_key][extended_class]

      for sub_context_key in items_to_check:
        if sub_context_key in local_context and var_name in local_context[sub_context_key]:
          return sub_context_key, local_context

      if 'extend' in local_context:
        new_extend = local_context['extend']

        if new_extend != extended_class:
          extended_classes.append(new_extend)

  return None, None

def _output_debug(*args, **kwargs):
  if debug_mode:
    print(*args, **kwargs)

def _check_func_call(child, name, arguments):
  _output_debug(child)
  _output_debug('Calling function %s with arguments: %s' % (name, arguments))
  pass

def _deep_check(children, local_context, item_type):
  item_found = False
  relative_context_str = children[0].value
  relative_context = local_context[relative_context_str]

  if relative_context == None:
    pass

  elif item_type == 'var' or item_type == 'const' or item_type == 'enum':

    for child in children[1:]:
      item_found = False
      relative_context_str += '.%s' % (child.value)
      relative_context_index = relative_context.index(child.value) if child.value in relative_context else None

      if relative_context_index != None:
        relative_context = relative_context[relative_context_index]
        item_found = True
      else:
        break

    if not item_found:
      var_type, var_context = _get_context(children[0].value)

      if var_type != None and var_context[var_type][children[0].value]['type'] != None:
        item_type = var_context[var_type][children[0].value]['type']
        var_type, var_context = _get_context(var_context[var_type][children[0].value]['type'])

        if var_type != None:
          relative_context = var_context[var_type][item_type]
          look_for_items = ['var', 'const', 'func', 'enum', 'signal']
          child_value = children[1].value

          for item_to_check in look_for_items:
            if item_to_check in relative_context and child_value in relative_context[item_to_check]:
              item_found = True
              relative_context = relative_context[item_to_check][child_value]
              break

          for child in children[2:]:
            item_found = False
            relative_context_str += '.%s' % (child.value)
            
            if child.value in relative_context:
              relative_context = relative_context[relative_context_index]
              item_found = True
            else:
              break

      else:
        item_found = relative_context['type'] == None

        if item_found:
          debug_message = 'Ignoring %s' % (relative_context_str)
          _output_message('debug', children[0], debug_message)

  elif item_type == 'class':
    item_found = len(children) < 2

    if not item_found:
      subitem_types = ['var', 'const', 'enum', 'func', 'signal']
      item_name = children[1].value
      relative_context_str += '.%s' % (item_name)

      for subitem_type in subitem_types:
        if subitem_type in relative_context and item_name in relative_context[subitem_type]:
          relative_context = relative_context[subitem_type][item_name]
          item_found = True

      for child in children[2:]:
        item_found = False
        relative_context_str += '.%s' % (child.value)
        relative_context_index = relative_context.index(child.value) if child.value in relative_context else None

        if relative_context_index != None:
          relative_context = relative_context[relative_context_index]
          item_found = True
    else:
      item_found = True

  elif item_type == 'func':
    # On cherche dans une fonction
    item_found = True

  elif item_type == 'signal':
    # On cherche dans une fonction
    pass

  if not item_found:
    error_message = ('%s not found' % (relative_context_str))
    _output_message('error', children[0], error_message)

def _check_attr(children, global_context_path):
  first_item = children

  if isinstance(children, list):
    first_item = children[0]

  if isinstance(first_item, Token):
    if first_item.type == 'NAME':
      relative_context_key, relative_context = _get_context(first_item.value, global_context_path)

      if relative_context_key != None:
        _deep_check(children, relative_context[relative_context_key], relative_context_key)
      else:
        error_message = ('%s not found' % (first_item.value))
        _output_message('error', first_item, error_message)
    else:
      _output_debug('Token: %s' % (first_item))
      # exit(0)
  elif isinstance(first_item, Tree):
    if first_item.data == 'funccall':
      return _check_attr(first_item.children, global_context_path)

    else:
      _output_debug('?: %s, %s' % (first_item.children[0], global_context_path))
      _output_debug(0)
  else:
    _output_debug('?: %s, %s' % (first_item, global_context_path))
    exit(0)

def _extract_enum(acc, token):
  if token.type == 'NAME':
    acc.append(token.value)

  return acc

def _is_class_name(class_name):
  return class_name in global_context['class']

def _get_item_type():
  pass

def _extract_assignation(children, global_context_path):
  if isinstance(children, list):
    children = children[0]

  if isinstance(children, type(None)):
    return None, None

  elif isinstance(children, Tree):
    if children.data == 'funccall':
      fc_type = None
      fc_name = None
      fc_arguments = []
      index = 0

      # TODO
      # Not working correctly
      for child in children.children:
        if index == 0:
          fc_name, _ = _extract_assignation(child, global_context_path)
        else:
          arg_name, _ = _extract_assignation(child, global_context_path)

          fc_arguments.append(arg_name)
        index += 1

      _check_func_call(children, fc_name, fc_arguments)

      if fc_name == 'keys' or fc_name =='values':
        fc_type = 'Array'
      elif fc_name == 'new':
        fc_type = '__self'
      elif fc_name == 'preload' or fc_name == 'load':
        fc_type = 'Resource'

        if fc_arguments[0].endswith('.png\'') or fc_arguments[0].endswith('.tex\''):
          fc_type = 'Texture'

        elif fc_arguments[0].endswith('.tscn\'') or fc_arguments[0].endswith('.scn\''):
          fc_type = 'CanvasItem'

      elif _is_class_name(fc_name):
        fc_type = fc_name

      return fc_name, fc_type

    elif children.data == 'list':
      return [], 'Array'

    elif children.data == 'dict':
      return {}, 'Dictionary'

    elif children.data == 'getattr':
      _attributes_to_check.append({
        'child': children.children,
        'context': [] + global_context_path
      })

      return _extract_assignation(children.children[0], global_context_path)

    elif children.data == 'arguments' or children.data == 'string' \
      or children.data == 'number':
      return _extract_assignation(children.children[0], global_context_path)

  elif isinstance(children, Token):
    if children.type == 'STRING' or children.type == 'LONG_STRING':
      return children.value, 'String'

    elif children.type == 'DEC_NUMBER' or children.type == 'HEX_NUMBER' \
      or children.type == 'OCT_NUMBER' or children.type == 'BIN_NUMBER':
      return children.value, 'int'

    elif children.type == 'FLOAT_NUMBER' or children.type == 'IMAG_NUMBER':
      return children.value, 'float'

    elif children.type == 'NULL_TOKEN':
      return children.value, None

    elif children.type == 'NAME':
      local_key, local_context = _get_context(children.value, global_context_path)
      item_type = None

      if local_key == 'class':
        item_type = children.value

      elif local_key == 'func':
        if 'return' in local_context[local_key][children.value]:
          item_type = local_context[local_key][children.value]['return']

      elif local_key == 'enum':
        item_type = 'int'

      elif local_key == 'const' or local_key == 'var':
        item_type = local_context[local_key][children.value]['type']

      return children.value, item_type

  else:
    return children.value, None

  return None, None

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
      relative_context_key, relative_context = _get_context(var_name, global_context_path)

      if relative_context_key == None:
        error_message = '\'%s %s\' not defined' % ('var', var_name)
        _output_message('error', children[0], error_message)

      else:
        var_ref = relative_context[relative_context_key]
        var_value, var_type = _extract_assignation(children[1:], global_context_path)

        var_ref[var_name] = {
          'value': var_value,
          'type': var_type
        }
  else:
    assign_var(children[0].children, global_context_path)

def _output_message(level, node, message):
  # Skip debug message
  if level == 'debug' and not debug_mode:
    return

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
      const_value, const_type = _extract_assignation(child.children[1].children, context_path)
      context['const'][const_name] = {
        'value': const_value,
        'type': const_type
      }

    elif child.data == 'var_stmt':
      var_name, assignation_data = _extract_var(child.children)

      _add_item_to_context('var', context, var_name, child.children[0], context_path)
      var_value, var_type = _extract_assignation(assignation_data, context_path)
      context['var'][var_name] = {
        'value': var_value,
        'type': var_type
      }

    elif child.data == 'classdef':
      class_name = child.children[0].value

      _add_item_to_context('class', context, class_name, child.children[0], context_path)
      context['class'][class_name] = {
        'func': {
          'new': {
            'return': '__self',
            'arguments': []
          }
        },
        'var': {
          'self': {
            'value': '__self',
            'type': '__self'
          }
        }
      }
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
        var_value = None
        var_type = None

        if isinstance(subchild, Tree):
          varname = subchild.children[0].value
          var_value, var_type = _extract_assignation(subchild.children[1:], context_path)
        else:
          var_value = subchild.value

        _add_item_to_context('var', context, varname, child, context_path)
        context['var'][varname] = {
          'value': var_value,
          'type': var_type,
          'parameter': True
        }

    elif child.data == 'if_stmt':
      pass

    elif child.data == 'funccall':
      _attributes_to_check.append({
        'child': child,
        'context': [] + context_path
      })

    elif child.data == 'for_stmt':
      pass

    elif child.data == 'while_stmt':
      pass

    elif child.data == 'signal':
      pass

    elif child.data == 'funcdef_extend':
      pass

    elif child.data == 'testlist':
      pass

    else:
      _output_debug(context_path)
      _output_debug(global_context)
      _output_debug(child.data)
      _output_debug(child.children)
      # exit(0)

def check_context():
  for _attribute_to_check in _attributes_to_check:
    _check_attr(_attribute_to_check['child'], _attribute_to_check['context'])

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


def usage():
  print('\nGDScript\n')
  print('Usage: %s [-d] <file>' % (sys.argv[0]))

def main():
  try:
    opts, args = getopt.getopt(sys.argv[1:], 'd')

    if len(args) != 1:
      usage()

      return 2

    for o, a in opts:
      if o == '-d': debug_mode = True
  except getopt.GetoptError:
    usage()

    return 2

  os.chdir(__path__)
  kwargs = dict(rel_to = __real_file__, postlex = GDScriptIndenter(), start = 'file_input')
  gd_parser = Lark.open('gd.lark', parser = 'lalr', **kwargs)

  input_text = _read(args[0]) + '\n'

  try:
    parsed_file = gd_parser.parse(input_text)

    analyze_tree(parsed_file, global_context)
    check_context()
    # print(json.dumps(global_context, sort_keys = True, indent = 2))
  except UnexpectedInput as error:
    _output_message('fatal', error, error.get_context(input_text))

if __name__ == '__main__':
  main()
