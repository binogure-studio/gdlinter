import xml.etree.ElementTree as ET

def _extract_context(element, subcontext):
  for item in element:
    if item.tag == 'members':
      if not 'var' in subcontext:
        subcontext['var'] = {}

      _extract_context(item, subcontext['var'])

    elif item.tag == 'member':
      name = item.attrib['name']
      subcontext[name] = {
        'value': None,
        'type': item.attrib['type']
      }

    elif item.tag == 'constants':
      if not 'const' in subcontext:
        subcontext['const'] = {}

      _extract_context(item, subcontext['const'])

    elif item.tag == 'constant':
      name = item.attrib['name']
      subcontext[name] = {
        'value': item.attrib['value']
      }

    elif item.tag == 'methods':
      if not 'func' in subcontext:
        subcontext['func'] = {}

      _extract_context(item, subcontext['func'])

    elif item.tag == 'method':
      method_name = item.attrib['name']

      subcontext[method_name] = {
        'return': None,
        'arguments': []
      }

      for subitem in item:
        if subitem.tag == 'return':
          subcontext[method_name]['return'] = subitem.attrib['type']

        elif subitem.tag == 'argument':
          subcontext[method_name]['arguments'].append(subitem.attrib['type'])

    elif item.tag == 'signals':
      subcontext['signal'] = {}

      _extract_context(item, subcontext['signal'])

    elif item.tag == 'signal':
      signal_name = item.attrib['name']

      subcontext[signal_name] = []

      for subitem in item:
        if subitem.tag == 'argument':
          subcontext[signal_name].append(subitem.attrib['type'])

def get_context():
  tree = ET.parse('classes.xml')
  root = tree.getroot()

  godot_context = {
    'class': {},
    'var': {
      'self': {
        'value': '__self',
        'type': '__self'
      }
    },
    'func': {
      'new': {
        'return': '__self',
        'arguments': []
      }
    },
    'const': {},
  }

  for child in root:
    className = child.attrib['name']
    subcontext = godot_context

    if className != '@GDScript' and className != '@Global Scope':
      godot_context['class'][className] = {
        'func': {
          'new': {
            'return': '__self',
            'arguments': []
          }
        }
      }

      subcontext = godot_context['class'][className]

      if 'inherits' in child.attrib:
        godot_context['class'][className]['extend'] = child.attrib['inherits']

    _extract_context(child, subcontext)

  return godot_context