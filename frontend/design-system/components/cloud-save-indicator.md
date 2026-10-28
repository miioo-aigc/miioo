# 云保存状态图标

CloudSaveIndicator 是画布与剪辑共用的纯展示组件，状态由业务层传入。

- idle、pending：白色60%；saving：品牌蓝轮廓动画；success：品牌蓝；error：错误色。
- 接收 status、label、onClick、disabled、style；提供 onClick 时渲染原生按钮，否则渲染状态标识。
- 保存中禁止点击，支持键盘焦点和减少动态效果偏好。图标16px，默认容器24×22px；业务方可调整点击区域。
- 画布保留左边距及原提示，剪辑使用32×32px点击区域，支持手动保存和失败重试。
