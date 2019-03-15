# GDLinter (WIP)

Aim of this module is to have a linter that is not using Godot Engine

## Usage

Works with Godot engine 2.1 documentation (needs to be updated for 3+).

### Setup

Checkout godot engine v2 in the parent folder. This will open the documentation and parse it.
Your code have to use spaces (no tabs) using 2 spaces only

### Run

Change to the directory where you want to run the linter.
Then run:

```sh
# Directory tree example
# root/
# - yourGame/ <= you are here
# - gdlinter/
node ../gdlinter/index.js
```

# TODO

- Add configuration file (to define indentation)
- Add test cases
- Add support for Godot Engine 3+
- Produce an XML output
- Improve rules definitions

