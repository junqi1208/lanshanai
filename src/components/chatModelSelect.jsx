import { useCallback, useMemo, useState } from "react"
import { Dropdown, Tooltip } from "antd"
import { DownOutlined } from "@ant-design/icons"
import { CHAT_MODELS, CHAT_MODEL_VENDORS, getChatModelMeta } from "@/constants/chatModels"

function ModelMenuLabel({ model }) {
  return (
    <Tooltip
      title={model.hint || model.desc}
      placement="right"
      mouseEnterDelay={0.15}
      classNames={{ root: "chat-main-model-tooltip" }}
      destroyOnHidden
    >
      <span className="chat-main-model-menu-label">{model.label}</span>
    </Tooltip>
  )
}

export default function ChatModelSelect({ value, onChange, disabled = false, className = "" }) {
  const [open, setOpen] = useState(false)
  const current = getChatModelMeta(value)

  const menuItems = useMemo(
    () =>
      CHAT_MODEL_VENDORS.map((vendor) => ({
        type: "group",
        label: vendor.label,
        children: CHAT_MODELS.filter((item) => item.vendor === vendor.key).map((model) => ({
          key: model.value,
          label: <ModelMenuLabel model={model} />,
        })),
      })),
    [],
  )

  const handleSelect = useCallback(
    ({ key }) => {
      if (key !== value) {
        onChange?.(key)
      }
      setOpen(false)
    },
    [onChange, value],
  )

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      trigger={["click"]}
      disabled={disabled}
      placement="bottomLeft"
      classNames={{ root: "chat-main-model-dropdown" }}
      menu={{
        items: menuItems,
        selectable: true,
        selectedKeys: [value],
        onClick: handleSelect,
      }}
    >
      <button
        type="button"
        className={`chat-main-model-trigger chat-header-control ${open ? "is-open" : ""} ${className}`.trim()}
        disabled={disabled}
        aria-label="选择模型"
        aria-expanded={open}
      >
        <span className="chat-main-model-trigger-label">{current.label}</span>
        <DownOutlined className="chat-main-model-trigger-icon" />
      </button>
    </Dropdown>
  )
}
