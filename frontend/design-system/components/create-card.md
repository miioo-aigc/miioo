# 新建卡片

CreateCard 复用原项目列表新建项目卡片视觉，供项目、剪辑草稿、Seedance 真人录入/素材组、Seedance 文件夹上传和画布素材库新增文件夹入口使用。

- 宽度跟随网格，比例3:2；8px圆角、1.5px白色20%虚线边框。
- 默认背景#1D1E1E，悬停#252626；32px圆形底承载20px加号，文字13px、白色40%。
- 接收label、onClick、disabled、busy、className；className 用于保留调用方尺寸约束（素材库最大宽度270px）；禁用或忙碌时禁止点击，忙碌通过aria-busy表达。
- 原生按钮支持键盘操作，聚焦使用品牌色轮廓；无业务API、Store或路由依赖。

- 支持透传原生按钮属性（如 aria-haspopup、aria-expanded）；上传入口保留242×160px容器，使用h-full填满原尺寸，菜单与上传逻辑由业务组件维护。
