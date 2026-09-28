# 🌟摸鱼 TV 搭建属于自己的视频站

## 前言🔉

你是否有时烦恼自己想观看某个电影或者电视找不到资源，或者之前自己看的网站倒闭了，那不妨来自己搭一个视频🚉！让你的兄弟、好姐妹、女朋友对你眼前一亮！这个项目是根据 maccms10 视频资源规则来实现的，项目是纯前端项目❤️‍🔥，后面我也会给出配合后端方向的改进点，欢迎大家扩展。

![image-20250411095144280](./public/img/image-20250411095144280.png) 

## 项目介绍🤩

项目在线地址🚀：<https://tv.yucoder.cn/>

项目 Github 地址🔥：<https://github.com/lhccong/fishTV>

项目是基于 React + Dplayer + Nginx 反代 +  maccms10 视频资源规则实现的，目前项目实现了手机端的适配以及可以查看历史内容、切换暗黑模式等基础功能，已经与日常网站播放十分相似。

### Redis、登录与管理后台

服务端现已内置 Redis、摸鱼岛强制登录和管理后台。首次启动不要求预先写环境变量：打开站点会进入网页安装向导，安装口令只打印在服务端启动控制台。向导中填写 Redis、站点地址、摸鱼岛 OAuth 应用和管理员账号，配置会保存到 `data/config.json`。

```shell
REDIS_URL=redis://127.0.0.1:6379/0
YUCODER_CLIENT_ID=...
YUCODER_CLIENT_SECRET=...
SITE_ORIGIN=https://你的站点域名
```

也可以使用 Redis 分项环境变量。环境变量只用于兼容已有部署；没有环境变量时优先使用网页安装。安装完成后普通用户必须通过摸鱼岛登录才能访问视频代理，后台使用独立管理员账号。管理员可在 `/admin` 修改 OAuth 配置和账号密码。

生产环境必须使用 HTTPS、设置不带末尾斜杠的 `SITE_ORIGIN` 并连接 Redis。登录会话、OAuth state、管理员凭据和安装状态均保存在 Redis 或 `data/` 持久化目录中。

### 房间大厅

左侧“创建房间”或顶部“房间”进入 `/rooms`。大厅支持创建房间、查看房间卡片并加入；创建或加入后进入 `/rooms/:roomId` 独立观影页，右侧为聊天室。房主可按分类、视频源搜索选片及选集，点击“共同播放”后全房间开始观看；未选片时其他成员显示“暂无播放”。普通播放页独立播放，不会改动房间影片。

房间播放支持视频源中的 HLS、MP4、WebM、Ogg 直链，不支持同步第三方 iframe 播放器。成员无法改动服务端播放状态；浏览器阻止自动播放时需点击“开始观看”。观影页适配窗口高度，影片等比完整显示；片库、成员列表与聊天记录在各自区域内滚动，整页不随内容增长。房间页刷新会按地址重新加入，断线后会重新同步。列表失败会显示错误与重试按钮，不会把失败当成空房间。

播放器右下角、原生控制条上方统一放置弹幕、聊天和全屏按钮，快捷键分别为 `D`、`C`、`F`；输入文字时不触发快捷键。全屏按钮（或双击画面）将视频和聊天浮层一起全屏。普通模式和全屏模式均可通过聊天图标展开悬浮聊天室，支持发送消息与再次收起；消息复用房间原有聊天接口和权限。实时新消息同时显示为弹幕，可通过弹幕图标关闭；不会重播聊天历史。弹幕最多同时显示四行，拥挤时限量排队，完整消息仍保留在聊天记录中。发送失败保留草稿，断线时禁止发送。浏览器不支持元素全屏时改用页面铺满模式，点击退出按钮或按 Escape 返回；系统“减少动态效果”启用时弹幕改为静止淡出。

部署按单 Node 实例运行：房间写操作在该实例中串行执行，避免聊天和选片互相覆盖；这不是多实例 Redis 分布式锁。播放状态追加可选 `title`，旧数据仍可读取；`set_playback_clock` 的可选 `revision` 用于拒绝旧播放状态。无参数事件兼容旧版 ACK 调用方式。

普通导航不显示后台入口，管理员仍可直接访问 `/admin`，原有后台鉴权不变。此调整无新增配置或 Redis 数据迁移；部署需重新构建前端并重启 Node 服务。回滚时一并回退大厅、共享连接和 Socket ACK 接口改动。

### 后台房间管理与密码

后台使用独立菜单切换运行概览、房间管理、视频源、站点配置和管理员账号，不再把所有表单堆在一页；`/admin?view=rooms` 直接打开房间管理。房间列表及编辑区提供移除按钮，确认后删除房间并通知在线成员退出，同时释放房主的创建名额。删除不可撤销。

管理员在 `/admin` 的“房间管理”可查看房间及在线成员，设置全局空房清理分钟数、单房独立时限或永驻。默认 `0` 不自动清理；计时从最后一人离开开始，有人在线不删除。创建房间可设置密码，房主和管理员可修改或取消密码；邀请链接不带密码，访客登录后按需输入。

本功能需要重启 Node 服务，保持单实例部署。数据、接口、清理规则及密码版本回滚注意事项见 [房间管理说明](docs/ROOMS.md)。

### 分类界面

![image-20250411095532873](./public/img/image-20250411095532873.png)

### 详情界面

![image-20250411095559108](./public/img/image-20250411095559108.png)

### 播放界面

![image-20250411095755998](./public/img/image-20250411095755998.png)

## 项目部署操作🍉

### 基于 Nginx 反向代理

由于有不同的数据源需要操作，而往往这些数据源都涉及了跨域，那么为了避免跨域我直接从 Nginx 反向代理解决了跨域问题。

1、拉取源码到本地：<https://github.com/lhccong/fishTV>   请给主播点个 star 不要白嫖呀。

```shell
git clone  https://github.com/lhccong/fishTV
```

2、修改数据源。

目前我的数据源有三个，都通过了 Nginx 反向代理来处理，你可以使用我的或者直接自己加上自己的反向代理。

文件位置：src/api/config.ts

![image-20250411100539659](./public/img/image-20250411100539659.png)

修改这几个就是基于maccms10 规则的数据源了，后面我会给出一堆的数据源给大家的。

我 nginx 的反代跨域配置文件也给到大家如下⬇️。

```nginx
location ^~ /heimuer {
        proxy_pass https://heimuer.tv/;
        proxy_set_header Host heimuer.tv;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_ssl_server_name on;

        # 解决 CORS 问题
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range";
        add_header Access-Control-Expose-Headers "Content-Length,Content-Range";

        # 处理 OPTIONS 预检请求
        if ($request_method = OPTIONS) {
            return 204;
        }
}
location ^~ /ikun {
    proxy_pass https://api.ffzyapi.com/; 
    proxy_set_header Host api.ffzyapi.com; 
    proxy_set_header X-Real-IP $remote_addr; 
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; 
    proxy_ssl_server_name on; 
    # 解决 CORS 问题
    add_header Access-Control-Allow-Origin *; 
    add_header Access-Control-Allow-Methods "GET, POST, OPTIONS"; 
    add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range"; 
    add_header Access-Control-Expose-Headers "Content-Length,Content-Range"; 
    # 处理 OPTIONS 预检请求
    if ($request_method = OPTIONS) {
        return 204; 
    }
    add_header Cache-Control no-cache; 
}
location ^~ /subocaiji {
    proxy_pass http://subocaiji.com/; 
    proxy_set_header Host subocaiji.com; 
    proxy_set_header X-Real-IP $remote_addr; 
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; 
    proxy_ssl_server_name on; 
    # 解决 CORS 问题
    add_header Access-Control-Allow-Origin *; 
    add_header Access-Control-Allow-Methods "GET, POST, OPTIONS"; 
    add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range"; 
    add_header Access-Control-Expose-Headers "Content-Length,Content-Range"; 
    # 处理 OPTIONS 预检请求
    if ($request_method = OPTIONS) {
        return 204; 
    }
    add_header Cache-Control no-cache; 
}
```

3、打包项目

```shell
tsc -b && vite build --outDir dist
```

![image-20250411101005788](./public/img/image-20250411101005788.png)

生成 dist 就可以丢到服务器访问了

### 基于 Express 作为反向代理

1、拉取源码到本地：https://github.com/lhccong/fishTV

```shell
git clone  https://github.com/lhccong/fishTV
```

2、打包项目

```shell
npm run build
```

3、上传服务器

上传1个文件夹2个文件文件：

- 打包后生成的 dist 文件夹
- server.ts
- package.json

4、启动项目

```shell
npm install
npm run serve
```

这样服务就会在 http://localhost:3000 启动

5、宝塔反向代理（可选）

用宝塔启动项目后，打开外网映射，添加域名就可以访问了
![image-20260312165156083](./public/img/image-20260312165156083.png)

## 项目实现原理🚀

项目实现很简单就是基于 maccms10 api 来直接读取别人资源站的 json ，但是目前很多地方都没有怎么清晰讲解如何使用，我也是把我了解到的这个 api 的 参数给到大家。具体的官方文档可以直接查看

<https://github.com/magicblack/maccms10/blob/master/%E8%AF%B4%E6%98%8E%E6%96%87%E6%A1%A3/API%E6%8E%A5%E5%8F%A3%E8%AF%B4%E6%98%8E.txt>

```json
api接口仅供提供数据

视频接口同时支持老板xml格式的数据，增加参数 &at=xml即可。

1,视频部分
列表http://域名/api.php/provide/vod/?ac=list
详情http://域名/api.php/provide/vod/?ac=detail
同样支持老板xml格式的数据
列表api.php/provide/vod/at/xml/?ac=list
详情api.php/provide/vod/at/xml/?ac=detail

2,文章部分
列表http://域名/api.php/provide/art/?ac=list
详情http://域名/api.php/provide/art/?ac=detail

3,演员部分
列表http://域名/api.php/provide/actor/?ac=list
详情http://域名/api.php/provide/actor/?ac=detail

4,角色部分
列表http://域名/api.php/provide/role/?ac=list
详情http://域名/api.php/provide/role/?ac=detail

5,网址部分
列表http://域名/api.php/provide/website/?ac=list
详情http://域名/api.php/provide/website/?ac=detail

列表数据格式：

{"code":1,"msg":"数据列表","page":1,"pagecount":1,"limit":"20","total":15,"list":[{"vod_id":21,"vod_name":"测试1","type_id":6,"type_name":"子类1","vod_en":"qingjian","vod_time":"2018-03-29 20:50:19","vod_remarks":"超清","vod_play_from":"youku"},{"vod_id":20,"vod_name":"测试2","type_id":6,"type_name":"子类1","vod_en":"baolijiequ","vod_time":"2018-03-27 21:17:52","vod_remarks":"超清","vod_play_from":"youku"},{"vod_id":19,"vod_name":"测试3","type_id":6,"type_name":"子类3","vod_en":"chaofanzhizhuxia2","vod_time":"2018-03-27 21:17:51","vod_remarks":"高清","vod_play_from":"youku"},{"vod_id":18,"vod_name":"测试4","type_id":6,"type_name":"子类4","vod_en":"muxingshangxing","vod_time":"2018-03-27 21:17:37","vod_remarks":"高清","vod_play_from":"youku"},{"vod_id":15,"vod_name":"测试5","type_id":6,"type_name":"子类5","vod_en":"yingxiongbense2018","vod_time":"2018-03-22 16:09:17","vod_remarks":"高清","vod_play_from":"qiyi,sinahd"},{"vod_id":13,"vod_name":"测试6","type_id":8,"type_name":"子类6","vod_en":"piaoxiangjianyu","vod_time":"2018-03-21 20:37:52","vod_remarks":"全36集","vod_play_from":"youku,qiyi"},{"vod_id":14,"vod_name":"测试7","type_id":8,"type_name":"子类7","vod_en":"guaitanzhimeiyingjinghun","vod_time":"2018-03-20 21:32:27","vod_remarks":"高清","vod_play_from":"qiyi"}]}


列表接收参数：
ac=list
t=类别ID
pg=页码
wd=搜索关键字
h=几小时内的数据
例如： http://域名/api.php/provide/vod/?ac=list&t=1&pg=5   分类ID为1的列表数据第5页


内容数据格式：
{"code":1,"msg":"数据列表","page":1,"pagecount":1,"limit":"20","total":1,"list":[{"vod_id":21,"vod_name":"测试1","type_id":6,"type_name":"子类1","vod_en":"qingjian","vod_time":"2018-03-29 20:50:19","vod_remarks":"超清","vod_play_from":"youku","vod_pic":"https:\/\/localhost\/view\/photo\/s_ratio_poster\/public\/p2259384068.jpg","vod_area":"大陆","vod_lang":"国语","vod_year":"2018","vod_serial":"0","vod_actor":"主演们","vod_director":"导演","vod_content":"这可是详情介绍啊","vod_play_url":"正片$http:\/\/localhost\/v_show\/id_XMTM0NTczNDExMg==.html"}]}



内容接收参数：
参数 ids=数据ID，多个ID逗号分割。
     t=类型ID
     pg=页码
     h=几小时内的数据

例如:   http://域名/api.php/provide/vod/?ac=detail&ids=123,567     获取ID为123和567的数据信息
        http://域名/api.php/provide/vod/?ac=detail&h=24     获取24小时内更新数据信息


另附上xml返回格式：
列表数据格式：
<?xml version="1.0" encoding="utf-8"?><rss version="5.0"><list page="1" pagecount="23" pagesize="20" recordcount="449"><video><last>2012-05-06 13:32:28</last><id>493</id><tid>9</tid><name><![CDATA[测试]]></name><type>子类1</type><dt>dplayer</dt><note><![CDATA[]]></note><vlink><![CDATA[http://localhost/vod/?493.html]]></vlink><plink><![CDATA[http://localhost/vodplay/?493-1-1.html]]></plink></video></list><class><ty id="1">分类1</ty><ty id="2">分类2</ty><ty id="3">分类3</ty><ty id="4">分类4</ty><ty id="5">子类1</ty><ty id="6">子类2</ty><ty id="7">子类3</ty><ty id="8">子类4</ty><ty id="9">子类5</ty><ty id="10">子类6</ty><ty id="11">子类7</ty><ty id="12">子类8</ty><ty id="13">子类9</ty><ty id="14">子类10</ty><ty id="15">子类11</ty></class></rss>

内容数据格式：
<?xml version="1.0" encoding="utf-8"?><rss version="5.0"><list page="1" pagecount="1" pagesize="20" recordcount="1"><video><last>2012-05-06 13:32:28</last><id>493</id><tid>9</tid><name><![CDATA[测试1]]></name><type>恐怖片</type><pic>http://localhost/uploads/20091130205750222.JPG</pic><lang>英语</lang><area>欧美</area><year>2012</year><state>0</state><note><![CDATA[]]></note><type>_9</type><actor><![CDATA[]]></actor><director><![CDATA[Ryan Schifrin]]></director><dl><dd from="qvod"><![CDATA[第1集$http://localhost/1.mp4|]]></dd></dl><des><![CDATA[<p>简单介绍。 <br /></p>]]></des><vlink><![CDATA[http://localhost/vod/?493.html]]></vlink><plink><![CDATA[http://localhost/vodplay/?493-1-1.html]]></plink></video></list></rss>
```

### 所用到的 API

获取页面数据列表：<https://heimuer.tv/api.php/provide/vod/?ac=videolist&pg=0&pagesize=10&t=1>

获取分类列表数据：<https://heimuer.tv/api.php/provide/vod/?ac=list&pagesize=1>

获取分集列表数据：详情页中获取，\[<https://heimuer.tv/api.php/provide/vod/?ac=detail&ids=%2046579](><https://heimuer.tv/api.php/provide/vod/?ac=detail&ids=> 46579)

所有基于maccms10 的资源站 API 都是一样的，只有前缀不同：前缀/api.php/provide/vod/?ac=videolist\&pg=0\&pagesize=10\&t=1

## 资源站接入大全 📚

- 暴风采集站：<https://publish.bfzy.tv/>
- 非凡采集站：<http://ffzy5.tv/> ✅
- 快看采集站：<https://kuaikanzy.net/>
- 乐视采集站：<https://www.leshizy1.com/>
- 量子采集站：[http://lzizy.net](http://lzizy.net/)
- 索尼采集站：<https://suonizy.net/>
- 红牛：<https://hongniuziyuan.net/>
- 优质资源库：[https://1080zyk6.com](https://1080zyk6.com/)
- 鸭鸭资源库：[https://yayazy.com](https://yayazy.com/)
- 牛牛资源：[https://niuniuzy.cc](https://niuniuzy.cc/)
- OK资源网：[https://okzyw.vip](https://okzyw.vip/)
- 49资源网：[https://49zyw.com](https://49zyw.com/)
- 360资源站：[https://360zy5.com](https://360zy5.com/)
- 奇虎资源站：[https://qihuzy4.com](https://qihuzy4.com/)
- 黑木耳:<https://www.heimuer.tv/> ✅
- 华为：<https://cjhwba.com/>
- 九月：<https://jiuyuezy.com/>
- 卧龙：<https://wolongzyw.com/>
- 虎牙：<https://huyazy.com/>
- 淘片：<https://www.taopianzy.com/index.html>
- ikun：<https://ikunzy.net/>
- 麒麟：<https://www.qilinzyz.com/>
- 急速：<https://www.jisuzy.com/>
- 豪华：<https://haohuazy.com/>
- 快车：<https://kuaichezy.com/>
- 速播：<https://www.suboziyuan.net/> ✅
- 新浪：<https://www.xinlangzy.net/>
- 光速：<https://guangsuzy.com/>
- 无尽：<https://www.wujinzy.net/>
- 金鹰：<https://jinyingzy.com/>
- 魔都：<https://moduzy.com/>

目前打 ✅ 的是我用到的资源站，其它的资源站感兴趣的朋友可以自己接入一下。

## 扩展点🌟

1. 实现用户登录，保存用户的收藏影片以及浏览历史记录。
2. 自己实现数据库，爬取资源站的内容来实现按年份、地区等视频的分类。
3. 实现在线一起观看功能，可以创建房间以及聊天，简单思路：通过 ws 同步播放、暂停等操作以及监听房间每个人的视频进度，若与房主有差别，轻微动态聊整播放速度追赶。

   参考：<https://github.com/synctv-org/synctv>  在线体验地址：<https://synctv.006.cloudns.org/web/>

   ![image-20250411102842004](./public/img/image-20250411102842004.png)

### 房间大厅入口

首页顶部集中显示当前账号和创建按钮；点击创建后在弹窗填写房间名称及可选密码。每个账号同时只能拥有一个未移除的房间，重复创建会提示进入已有房间；退出房间不释放名额。已有房间时，可从同一操作栏返回房间。下方卡片继续提供加入入口，支持浅色、深色及窄屏布局。

首页 `/` 直接展示观影大厅，原 `/rooms` 地址保留。普通页面使用顶部横向分类导航，不再显示左侧菜单；后台入口仍不在导航中展示。

顶部用户操作位于菜单右侧，搜索框在下一行居中显示，使用适配浅色和深色主题的边框；窄屏自动换行。

首次访问默认使用深色主题，不跟随操作系统配色；已有的主题选择继续保留，手动切换后会记住选择。

首页使用“和喜欢的人，一起看电影”的观影主题文案，房间列表展示为“发现放映室”；创建、加入及返回房间的流程不变。

切换影片分类时列表和页码重新初始化，忽略上一分类尚未完成的请求；加载占位跟随主题，加载失败可在列表下方重试。

详情页、播放页及影片卡片骨架统一使用主题占位颜色，深色模式不再显示浅色底条或亮白占位块。

房间顶部“邀请好友”可展示并复制邀请链接。链接使用当前站点的 `/rooms/房间号` 地址，已登录用户打开后自动加入；未登录用户先完成认证，再返回目标房间。链接不含账号凭据，也不绕过房间鉴权。浏览器禁止剪贴板访问时可手动复制；本地 localhost 链接仅适合本机访问，邀请他人时应从对方可访问的站点域名打开后复制。

普通播放页的“创建房间一起看”会创建并进入新房间，带入当前影片、视频源、集数及可读取的播放进度。普通播放与房间模式统一解析多线路地址，优先采用可同步直链；无可同步线路时仍可“创建并进入房间”，进入后重新选片，不发布不支持的播放地址。已在其他房间时先确认离开，不修改原房间播放。加入或设置播放失败可复用本次已创建的房间重试。创建请求超时不自动重发，服务端可能已经创建成功，可先查看首页房间列表。

## 最后 ✨

感谢大家看到最后，我是聪 希望可以跟大家一起学习，如果文章对大家有帮助的话不妨给我的新项目 [摸鱼岛🐟](https://github.com/lhccong/fish-island-backend) 点个免费的 star 🌟，我的 Github：[github.com/lhccong](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Flhccong) 如果里面有你感兴趣的项目也可以点个星星⭐和关注🔥，未来我还会持续写新的好玩的小项目。
