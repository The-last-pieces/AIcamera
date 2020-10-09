const cloud = require('wx-server-sdk')

cloud.init({
  // API 调用都保持和云函数当前所在环境一致
  env: cloud.DYNAMIC_CURRENT_ENV
})

function dealinput(msg) {
  return "成功接收字符串:" + msg;
}

// 云函数入口函数
exports.main = async (event, context) => {

  console.log(event)

  const {
    OPENID
  } = cloud.getWXContext()

  const result = await cloud.openapi.customerServiceMessage.send({
    touser: OPENID,
    msgtype: 'text',
    text: {
      content: dealinput(event.Content),
    }
  })

  console.log(result)

  return result
}
