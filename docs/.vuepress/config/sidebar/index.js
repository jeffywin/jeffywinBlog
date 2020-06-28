//侧边栏
module.exports = {
    '/views/': [
        '',
        {
            title: '基础知识',
            collapsable: true,
            children: [
            ]
        },
        // {
        //     title: '规范 Standard',
        //     collapsable: true,
        //     children: [
        //         'specification/ali',
        //         'specification/git',
        //         'specification/linux01',
        //         'specification/objectModel'
        //     ]
        // },
        {
            title: '前端 Front-end',
            collapsable: true,
            children: [
                'front-end/jeffywin-cli',
            ]
        },
        {
            title: '后端 Back-end',
            collapsable: true,
            children: [
                // 'java/ArrayList',
               
            ]
        },
        {
            title: '随笔 Essay',
            collapsable: true,
            children: [
                // 'essay/20190928',
            ]
        }

    ]
}