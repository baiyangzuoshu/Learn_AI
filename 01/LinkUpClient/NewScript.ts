// Learn TypeScript:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/life-cycle-callbacks.html

const { ccclass, property } = cc._decorator;

@ccclass
export default class NewClass extends cc.Component {

    @property(cc.Label)
    label: cc.Label = null;

    @property
    text: string = 'hello';

    // LIFE-CYCLE CALLBACKS:

    // onLoad () {}

    start() {

    }

    // update (dt) {}
}
/*
cc.Component拥有对应的生命周期，继承它，我们可以在onLoad写初始化的代码，在onDestroy中写清理的代码

本来坍塌的代码总共有上千行代码，后来想想阅读起来费劲，所以我把它分成了几个文件，每个文件负责一个功能，这样阅读起来就方便多了。
于是就有了文件夹Collapse下面的CollapseStrategy基类，和对应实现类,用的是策略模式拆分。

吸取上一个项目UIGameUICtrl庞大的教训，这次使用组合模式，拆分每个功能，每个功能都有自己的类，这样就不会庞大了。
每个类的代码量都在200行以下，阅读起来也比较方便，放在Game文件夹下面。

通过阅读代码，发现问题，优化代码。
拆分功能，删除冗余功能，健壮性更强。
实现方法有很多种，一种达不到要求，便要想另外一种。

生成算法
1.生成都是0的二维数组
2.随机生成n对可消除图块
3.遍历上下左右四边，封住边界，不可消除图块
4.遍历剩下的位置，搜集位置的上下左右的图块arr，从图块池中去除arr相同的图块，然后获取newCool,接着随机获取newCool中的图块，填充到当前位置。

特殊图块
1.冰块不可移动，有三个阶段，最后阶段消融后，需要处理坍塌方向
2.木块不可移动
3.磁铁不可移动，会吸住9个方向的图块，被清除之后，需要处理坍塌方向
4.藤曼可移动，不可消除
5.暗牌可移动
6.火箭可移动，消除之后，随机消除4组图块

字符串压缩算法：
1.使用字节流
2.encode避免特殊字符
3.二进制压缩
4.数字长度问题，如果是自增的role_id，那么可以用短整型表示，因为role_id最大只有1000000000，用32位表示绰绰有余。
但是最好使用字符串表示，因为字符串可以表示任意长度的数字，而短整型只能表示32位的数字。

大地图加载：
1.地图不可加载过多
2.地图上的按钮应该和地图分开,因为按钮和地图会存在遮挡问题
3.按钮也不可加载过多
4.滚动计算问题
5.DC问题，Label会打断Sprite之间的合批,使用图片字体解决

资源异步加载问题：
1.使用await会偶现多次加载，如果函数中有判断子节点是否存在，需要注意。

制作Label的Prefab,可以在运行时动态创建Label,避免重复创建。
1.可以把文本全部放在表格中，根据需要动态加载。
2.可以根据需要动态设置字体大小，颜色，对齐方式等。
3.可以根据需要动态设置文本内容，策划不需要频繁打开Prefab,只需要在表格中修改即可。

日志系统：
1.使用console.log打印日志
2.使用EventManager打印日志，方便查看日志

*/
