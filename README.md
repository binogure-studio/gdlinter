# GDScript-linter

**COMPATIBLE WITH 2.1 - NOT TESTED ON 3.x/4.x**

## Why?

I want to use a third party IDE, and I'm tired of having to use the Godot Editor to check if the code is correct.

## Setup

```sh
sudo apt-get install python3
sudo pip3 install lark
```

## Usage

```sh
python3 ./parser.py path-to-file.gd
```

## TODO

- [x] Lark grammar for GDscript
- [ ] Parse function call
- [ ] Parse `for` statement
- [ ] Parse `while` statement
- [ ] Parse `if` statement
- [-] Parse `expr` statement (partial)
- [x] Parse function definition
- [x] Parse var/const/enum declaration
- [x] Parse `return` statement
- [x] Detect variable shadowing
- [x] Detect undefined variable usage (simple)
- [ ] Detect undefined variable usage (deep check)
- [ ] Detect unused variables
