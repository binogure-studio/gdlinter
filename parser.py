#!/usr/bin/python3
import uuid
import json
import configparser
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

root_folder = os.getcwd()
project_file = None
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

def _get_context(var_name, global_context_path = [], items_to_check = ['class', 'var', 'const', 'enum', 'func', 'signal']):
  global global_context

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
  global debug_mode

  if debug_mode:
    print(*args, **kwargs)

def _check_func_call(child, name, arguments):
  _output_debug(child)
  _output_debug('Calling function %s with arguments: %s' % (name, arguments))
  pass

def _deep_check(children, local_context, item_type, global_context_path = []):
  item_found = False
  relative_context_str = children[0].value
  relative_context = local_context[relative_context_str]

  if relative_context == None:
    pass

  elif len(children) == 1 and (item_type == 'var' or item_type == 'const' or item_type == 'enum'):
    var_type, var_context = _get_context(children[0].value, global_context_path)
    item_found = relative_context_str in var_context[var_type]

  elif item_type == 'var' or item_type == 'const' or item_type == 'enum':
    for child in children[1:]:
      item_found = False
      relative_context_str += '.%s' % (child.value)
      relative_context_index = None
      
      if hasattr(relative_context, 'index') and child.value in relative_context:
        relative_context_index = relative_context.index(child.value)

      else:
        break

      if relative_context_index != None and relative_context[relative_context_index] != None:
        relative_context = relative_context[relative_context_index]
        item_found = True
      else:
        break

    if not item_found:
      var_type, var_context = _get_context(children[0].value, global_context_path)

      if var_type != None and var_context[var_type][children[0].value]['type'] != None:
        item_type = var_context[var_type][children[0].value]['type']
        var_type, var_context = _get_context(var_context[var_type][children[0].value]['type'], global_context_path)

        if var_type != None:
          do_done = False
          relative_context = var_context[var_type][item_type]
          look_for_items = ['class', 'var', 'const', 'func', 'enum', 'signal']
          child_value = children[1].value

          # Check for inherited classes
          while not item_found and not do_done:
            do_done = True

            for item_to_check in look_for_items:
              if item_to_check in relative_context and child_value in relative_context[item_to_check]:
                item_found = True
                relative_context = relative_context[item_to_check][child_value]
                break

            if not item_found and 'extend' in relative_context:
              item_type = relative_context['extend']
              var_type, var_context = _get_context(item_type)
              relative_context = var_context[var_type][item_type]
              do_done = False

          for child in children[2:]:
            item_found = False
            relative_context_str += '.%s' % (child.value)
            
            if child.value in relative_context:
              relative_context = relative_context[relative_context_index]
              item_found = True
            else:
              print('Item not found: %s' % (relative_context_str))
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
    # On cherche dans un signal
    pass

  if not item_found:
    error_message = ('%s not found!' % (relative_context_str))
    _output_message('error', children[0], error_message)
    exit(0)

def _check_attr(children, global_context_path):
  first_item = children

  if isinstance(children, list):
    first_item = children[0]

  if isinstance(first_item, Token):
    if first_item.type == 'NAME':
      relative_context_key, relative_context = _get_context(first_item.value, global_context_path)

      if relative_context_key != None:
        _deep_check(children, relative_context[relative_context_key], relative_context_key, global_context_path)
      else:
        error_message = ('%s not found' % (first_item.value))
        _output_message('error', first_item, error_message)
    else:
      _output_debug('Token: %s' % (first_item))
      # exit(0)
  elif isinstance(first_item, Tree):
    if first_item.data == 'funccall':
      return _check_attr(first_item.children, global_context_path)

    elif first_item.data == 'getattr':
      return _check_attr(first_item.children, global_context_path)

    else:
      _output_debug('?: %s, %s' % (first_item.children, global_context_path))
      exit(0)
  else:
    _output_debug('?: %s, %s' % (first_item, global_context_path))
    exit(0)

def _extract_enum(acc, token):
  if token.type == 'NAME':
    acc.append(token.value)

  return acc

def _is_class_name(class_name):
  global global_context

  return class_name in global_context['class']

def _get_item_type():
  pass

def _extract_parameters(children):
  parameters = []

  for child in children.children:
    parameters.append(child.value)

  return parameters

def _extract_assignation(children, analyze_items, global_context_path):
  global _attributes_to_check

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
          fc_name, _ = _extract_assignation(child, analyze_items, global_context_path)
        else:
          arg_name, _ = _extract_assignation(child, analyze_items, global_context_path)

          fc_arguments.append(arg_name)
        index += 1

      _check_func_call(children, fc_name, fc_arguments)

      if fc_name == 'keys' or fc_name =='values':
        fc_type = 'Array'
      elif fc_name == 'new':
        fc_type = '__self'
      elif fc_name == 'preload' or fc_name == 'load':
        fc_type = 'Resource'

        if len(fc_arguments) < 1 or fc_arguments[0] == None:
          pass

        elif fc_arguments[0].endswith('.gd\''):
          fc_type = 'GDScript'

        elif fc_arguments[0].endswith('.png\'') or fc_arguments[0].endswith('.tex\''):
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
      if analyze_items:
        _attributes_to_check.append({
          'child': children.children,
          'context': [] + global_context_path
        })

      return _extract_assignation(children.children[0], analyze_items, global_context_path)

    elif children.data == 'arguments' or children.data == 'string' \
      or children.data == 'number':
      return _extract_assignation(children.children[0], analyze_items, global_context_path)

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
  global global_context

  items_to_check = ['class', 'var', 'const', 'enum', 'func', 'signal']
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
    error_message = ('\'%s\' shadowing' % (item_name))

    if isinstance(item_context, Tree):
      _output_message('error', item_context.children[0], error_message)

    else:
      _output_message('error', item_context, error_message)

def _extract_test_stmt(children, context, analyze_items, context_path):
  global _attributes_to_check

  # Guardian clause
  # We dont' analyze any parent items
  if not analyze_items:
    return

  if isinstance(children, Token):
    if (children.type == 'NAME' and children.value != 'true' and children.value != 'false'):
      _attributes_to_check.append({
        'child': [children],
        'context': [] + context_path
    })

  elif children.data == 'getattr':
    _attributes_to_check.append({
      'child': children,
      'context': [] + context_path
    })

  else:
    for child in children.children:
      _extract_test_stmt(child, context, analyze_items, context_path)

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

def _add_item_to_context(_type, _context, _key, first_child, _analyze_items, _context_path):
  if not _type in _context:
    _context[_type] = {}

  if _analyze_items:
    _check_duplicate(_type, first_child, _key, _context_path)

def assign_var(children, analyze_items, global_context_path):
  if isinstance(children[0], Token):
    if children[0].type == 'NAME':
      var_name = children[0].value
      relative_context_key, relative_context = _get_context(var_name, global_context_path)

      if relative_context_key == None:
        error_message = '\'%s\' not defined' % (var_name)
        _output_message('error', children[0], error_message)

      else:
        var_ref = relative_context[relative_context_key]
        var_value, var_type = _extract_assignation(children[1:], analyze_items, global_context_path)

        var_ref[var_name] = {
          'value': var_value,
          'type': var_type
        }
  else:
    assign_var(children[0].children, analyze_items, global_context_path)

def _output_message(level, node, message):
  global debug_mode

  # Skip debug message
  if level == 'debug' and not debug_mode:
    return

  print('%s:%d:%d:%s' % (
    level,
    node.line,
    node.column,
    message
  ))

def goto_context(context_path):
  global global_context
  context = global_context

  for key in context_path:
    context = context[key]

  return context

def analyze_tree(tree, context, analyze_items = True, context_path = []):
  global global_context
  global _attributes_to_check

  for child in tree.children:
    if child.data == 'tool' or child.data == 'noop':
      continue

    elif child.data == 'suite' or child.data == 'compound_stmt' or child.data == 'return_stmt':
      if len(child.children) > 0:
        analyze_tree(Tree(child.children[0].data, child.children), context, analyze_items, context_path)

    elif child.data == 'extenddef' or child.data == 'file_extenddef_class':

      context['extend'] = child.children[0].value

    elif child.data == 'file_extenddef_file':

      load_file(child.children[0], child.children[0].value)

    elif child.data == 'enum':
      enum_name = child.children[0].value

      _add_item_to_context('enum', context, enum_name, child.children[0], analyze_items, context_path)
      context['enum'][enum_name] = functools.reduce(_extract_enum, child.children[1].children, [])

    elif child.data == 'const':
      const_name = child.children[0].value

      _add_item_to_context('const', context, const_name, child.children[0], analyze_items, context_path)
      const_value, const_type = _extract_assignation(child.children[1].children, analyze_items, context_path)
      context['const'][const_name] = {
        'value': const_value,
        'type': const_type
      }

    elif child.data == 'var_stmt':
      var_name, assignation_data = _extract_var(child.children)

      _add_item_to_context('var', context, var_name, child.children[0], analyze_items, context_path)
      var_value, var_type = _extract_assignation(assignation_data, analyze_items, context_path)
      context['var'][var_name] = {
        'value': var_value,
        'type': var_type
      }

    elif child.data == 'classdef':
      class_name = child.children[0].value

      _add_item_to_context('class', context, class_name, child.children[0], analyze_items, context_path)
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

      analyze_tree(Tree(class_name, child.children[1:]), context['class'][class_name], analyze_items, new_context_path)

    elif child.data == 'static_funcdef':
      analyze_tree(Tree(child.children[0].data, child.children), context, analyze_items, context_path)

    elif child.data == 'funcdef':
      func_name = child.children[0].value

      # Check that the func does not already exists
      _add_item_to_context('func', context, func_name, child.children[0], analyze_items, context_path)
      context['func'][func_name] = {}
      new_context_path = context_path + ['func', func_name]

      analyze_tree(Tree(func_name, child.children[1:]), context['func'][func_name], analyze_items, new_context_path)

    elif child.data == 'expr_stmt':
      assign_var(child.children, analyze_items, context_path)

    elif child.data == 'parameters':
      for subchild in child.children:
        varname = subchild
        var_value = None
        var_type = None

        if isinstance(subchild, Tree):
          varname = subchild.children[0].value
          var_value, var_type = _extract_assignation(subchild.children[1:], analyze_items, context_path)
        else:
          var_value = subchild.value

        _add_item_to_context('var', context, varname, child, analyze_items, context_path)
        context['var'][varname] = {
          'value': var_value,
          'type': var_type,
          'parameter': True
        }

    elif child.data == 'if_stmt':
      # - Analyze the if statement itself
      _extract_test_stmt(child.children[0], context, analyze_items, context_path)

      block_name = str(uuid.uuid4())
      _add_item_to_context('block', context, block_name, child.children[0], analyze_items, context_path)
      context['block'][block_name] = {}
      new_context_path = context_path + ['block', block_name]

      analyze_tree(Tree('block', child.children[1:]), context['block'][block_name], analyze_items, new_context_path)

    elif child.data == 'else_stmt' or child.data == 'elif_stmt' or child.data == 'first_elif_stmt':
      # Remove the last 2 arguments
      if child.data == 'first_elif_stmt':
        context_path.pop()
        context_path.pop()
        context = goto_context(context_path)
      
      if child.data == 'elif_stmt' or child.data == 'first_elif_stmt':
        _extract_test_stmt(child.children[0], context, analyze_items, context_path)

      block_name = str(uuid.uuid4())
      _add_item_to_context('block', context, block_name, child.children[0], analyze_items, context_path)
      context['block'][block_name] = {}
      new_context_path = context_path + ['block', block_name]

      analyze_tree(Tree('block', child.children[1:]), context['block'][block_name], analyze_items, new_context_path)

    elif child.data == 'funccall':
      if analyze_items:
        _attributes_to_check.append({
          'child': child,
          'context': [] + context_path
        })

    elif child.data == 'for_stmt':
      # Create the new block
      block_name = str(uuid.uuid4())
      _add_item_to_context('block', context, block_name, child.children[0], analyze_items, context_path)
      context['block'][block_name] = {}
      new_context_path = context_path + ['block', block_name]

      var_name = child.children[0].children[0].value
      # TODO
      # Add the var to a separated context in order to prevent it from leaking
      _add_item_to_context('var', context['block'][block_name], var_name, child.children[0], analyze_items, new_context_path)
      context['block'][block_name]['var'][var_name] = {
        'value': None,
        'type': None
      }

      analyze_tree(Tree('block', child.children[1:]), context['block'][block_name], analyze_items, new_context_path)

    elif child.data == 'while_stmt':
      # - Analyze the while statement itself
      _extract_test_stmt(child.children[0], context, analyze_items, context_path)

      block_name = str(uuid.uuid4())
      _add_item_to_context('block', context, block_name, child.children[0], analyze_items, context_path)
      context['block'][block_name] = {}
      new_context_path = context_path + ['block', block_name]

      analyze_tree(Tree('block', child.children[1:]), context['block'][block_name], analyze_items, new_context_path)

    elif child.data == 'signal':
      signal_name = child.children[0].value
      parameters = []

      if len(child.children) > 1:
        parameters = _extract_parameters(child.children[1])

      _add_item_to_context('signal', context, signal_name, child.children[0], analyze_items, context_path)

      context['signal'][signal_name] = {
        'parameters': parameters
      }

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
  global _attributes_to_check

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
  print('Usage: %s [-d] [-p <absolute path to project file>] <file>' % (sys.argv[0]))

def load_file(children, filename):
  global root_folder
  global global_context
  global file_analyzing

  os.chdir(__path__)

  kwargs = dict(rel_to = __real_file__, postlex = GDScriptIndenter(), start = 'file_input')
  gd_parser = Lark.open('gd.lark', parser = 'lalr', **kwargs)
  computed_filename = filename.replace('res:/', root_folder, 1).replace('\'', '', 2)

  if file_analyzing != computed_filename:
    input_text = _read(computed_filename) + '\n'

    try:
      parsed_file = gd_parser.parse(input_text)

      analyze_tree(parsed_file, global_context, False)
      # print(json.dumps(global_context, sort_keys = True, indent = 2))
      # check_context()
    except UnexpectedInput as error:
      _output_message('fatal', error, error.get_context(input_text))

  else:
    _output_message('error', children, 'Cyclic dependencies')

def main():
  global debug_mode
  global global_context
  global project_file
  global root_folder
  global file_analyzing

  try:
    opts, args = getopt.getopt(sys.argv[1:], 'p:d', ['project_path=', 'debug='])
    if len(args) < 1:
      usage()

      return 2

    for o, a in opts:
      if o == '-d':
        debug_mode = True

      if o == '-p':
        root_folder = a
        project_file =  '%s/engine.cfg' % (a)

  except getopt.GetoptError as e:
    print("ERROR: %s" % e)
    usage()

    return 2

  os.chdir(__path__)

  kwargs = dict(rel_to = __real_file__, postlex = GDScriptIndenter(), start = 'file_input')
  gd_parser = Lark.open('gd.lark', parser = 'lalr', **kwargs)
  file_analyzing = args[0]
  input_text = _read(file_analyzing) + '\n'

  if project_file != None and os.path.isfile(project_file):
    config = configparser.RawConfigParser()
    config.read(project_file)

    if config.has_section('autoload'):
      autoload_section = config.options('autoload')

      for var_name in autoload_section:
        # TODO
        # Parse the global scripts and add them to the context
        global_context['var'][var_name] = {
          'value': config.get('autoload', var_name).replace('*res://', 'res://').replace('"', ''),
          'type': None
        }

  try:
    parsed_file = gd_parser.parse(input_text)

    analyze_tree(parsed_file, global_context)
    # print(json.dumps(global_context, sort_keys = True, indent = 2))
    check_context()
  except UnexpectedInput as error:
    _output_message('fatal', error, error.get_context(input_text))

if __name__ == '__main__':
  main()
