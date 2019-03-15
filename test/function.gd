extends Control

const MOUSE_CURSOR = preload('res://texture/UI/theme/cursor.png')
const MOUSE_CURSOR_SELECT = preload('res://texture/UI/theme/cursor-select.png')
const MOUSE_CURSOR_FORBIDDEN = preload('res://texture/UI/theme/cursor-forbidden.png')
const MOUSE_CURSOR_CAN_DROP = preload('res://texture/UI/theme/cursor-can-drop.png')

var MOUSE_CURSOR_CAN_DROP

func _ready():
  scene_manager.clean_history()
  get_tree().set_use_font_oversampling(true)

  Input.set_custom_mouse_cursor(MOUSE_CURSOR, Control.CURSOR_ARROW, Vector2(7, 1))
  Input.set_custom_mouse_cursor(MOUSE_CURSOR_SELECT, Control.CURSOR_IBEAM, Vector2(11, 1))
  Input.set_custom_mouse_cursor(MOUSE_CURSOR_FORBIDDEN, Control.CURSOR_FORBIDDEN, Vector2(7, 1))
  Input.set_custom_mouse_cursor(MOUSE_CURSOR_CAN_DROP, Control.CURSOR_CAN_DROP, Vector2(7, 1))

func _on_Exit_pressed():
  soundfx_manager.play_sound(soundfx_manager.FX_SOUNDS.UI_CLICK)
  scene_manager.quit()
