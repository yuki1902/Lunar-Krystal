const axios = require("axios");
const fs = require("fs-extra");

const isDouyinVideoLink = url => /^https?:\/\/(www\.)?(douyin\.com|v\.douyin\.com)\/\S+/.test(url);
const isURL = u => /^http(|s):\/\//.test(u);

var scApiKeys = ["jn6PoPho", "WKd4XzHX", "FI6bX3kC"];
const scApi = scApiKeys[Math.floor(Math.random() * scApiKeys.length)];

exports.handleEvent = async function (o) {
  try {
    const str = o.event.body;
    const send = (msg) => o.api.sendMessage(msg, o.event.threadID, o.event.messageID);
    const head = (app) => `[ ${app.toUpperCase()} ] - Download\n\n`;
    const links = str.match(/(https?:\/\/[^)\s]+)/g) || [];

    for (const link of links) {
      /* Facebook */
      if (/fb|facebook/.test(link)) {
        try {
          const res = (await axios.get(`http://dongdev.click/api/down/media?url=${link}`)).data;
          await handleFacebookMedia(res, send);
        } catch (error) {
          send("Đã xảy ra lỗi khi tải nội dung từ Facebook.");
          console.error("Error downloading Facebook content:", error);
        }
      }

      /* YouTube */
      else if (/(^https:\/\/)((www)\.)?(youtube|youtu)(PP)*\.(com|be)\//.test(link)) {
        try {
          const res = (await axios.get(`https://subhatde.id.vn/youtube/download?url=${link}`)).data;
          if (res) await handleYouTubeMedia(res, send);
          else send("Không tìm thấy thông tin về video. Vui lòng kiểm tra lại đường dẫn!");
        } catch (e) {
          console.error("Error downloading YouTube video:", e);
          send("Đã xảy ra lỗi khi tải nội dung từ YouTube.");
        }
      }

      /* SoundCloud */
      else if (/(soundcloud)/.test(link)) {
        try {
          const { type, url } = checkLink(link);
          await downloadSoundCloud(url, type, o.api, o.event, send);
        } catch (error) {
          send("Đã xảy ra lỗi khi tải nội dung từ SoundCloud.");
          console.error("Error downloading SoundCloud content:", error);
        }
      }

      /* Douyin */
      else if (isDouyinVideoLink(link)) {
        try {
          const res = await axios.get(`https://subhatde.id.vn/tiktok/douyindl?url=${link}`);
          const videoData = res.data;

          if (videoData.attachments && videoData.attachments.length > 0) {
            const stream = (await axios.get(videoData.attachments[0].url, { responseType: "arraybuffer" })).data;
            const path = `${__dirname}/cache/${Date.now()}.mp4`;
            fs.writeFileSync(path, Buffer.from(stream, "utf-8"));
            send({
              body: `${head("DOUYIN")}📝 Tiêu đề: ${videoData.caption || "N/A"}\n──────────────────\n📺 Đây là tính năng tự động tải khi phát hiện link Douyin.`,
              attachment: fs.createReadStream(path),
            });
            setTimeout(() => fs.unlinkSync(path), 60 * 1000);
          } else {
            send("Không tìm thấy video từ bài đăng Douyin.");
          }
        } catch (error) {
          console.error("Error downloading Douyin video:", error);
          send("Đã xảy ra lỗi khi tải nội dung từ Douyin.");
        }
      }

      /* TikTok */
      else if (/(^https:\/\/)((vm|vt|www|v)\.)?(tiktok)\.com\//.test(str)) {
        try {
          const json = await infoPostTT(str);
          let attachment = [];
          if (json.images != undefined) {
            for (const $ of json.images) {
              attachment.push(await streamURL($, 'png'));
            }
          } else {
            attachment = await streamURL(json.play, 'mp4');
          }
          o.api.sendMessage({
            body: `${head('TIKTOK')}👤 Tên Kênh: ${json.author.nickname}\n📝 Tiêu Đề: ${json.title}\n📌 Thả cảm xúc 👍 để lấy link tải nhạc.\n──────────────────\n📺 Đây là tính năng tự động tải khi phát hiện link Tiktok.`,
            attachment
          }, o.event.threadID, (error, info) => {
            global.client.handleReaction.push({
              name: this.config.name,
              messageID: info.messageID,
              author: o.event.senderID,
              data: json
            });
          }, o.event.messageID);
        } catch (e) {
          send("Đã xảy ra lỗi khi tải nội dung từ TikTok.");
        }
      }

      /* Pinterest */
      else if (/(^https:\/\/)((www)\.)?(pinterest|pin)*\.(com|it)\//.test(str)) {
        try {
          const res = await axios.get(`https://api.imgbb.com/1/upload?key=588779c93c7187148b4fa9b7e9815da9&image=${str}`);
          send({
            body: `${head('PINTEREST')}📝 Link Tải: ${res.data.data.image.url}\n──────────────────\n📺 Đây là tính năng tự động tải khi phát hiện link Pinterest.`,
            attachment: await streamURL(res.data.data.image.url, 'jpg')
          });
        } catch (e) {
          send("Đã xảy ra lỗi khi tải nội dung từ Pinterest.");
        }
      }

      /* CapCut */
      else if (/capcut\.com/.test(link)) {
        try {
          const res = await axios.get(`https://subhatde.id.vn/capcut/download?url=${link}`);
          const videoData = res.data;
          const videoUrl = videoData.video_url;
          const videoStream = (await axios.get(videoUrl, { responseType: "arraybuffer" })).data;
          const path = `${__dirname}/cache/${Date.now()}.mp4`;
          fs.writeFileSync(path, Buffer.from(videoStream));

          send({
            body: `${head("CAPCUT")}📝 Tiêu đề: ${videoData.title || "N/A"}\n👤 Tác giả: ${videoData.author.name || "N/A"}\n❤ Lượt thích: ${videoData.like_count || 0}\n💬 Lượt bình luận: ${videoData.comment_count || 0}\n⏰ Thời lượng: ${videoData.duration || 0} giây\n──────────────────\n📺 Đây là tính năng tự động tải khi phát hiện link CapCut.`,
            attachment: fs.createReadStream(path)
          });

          setTimeout(() => fs.unlinkSync(path), 60 * 1000); 
        } catch (error) {
          console.error("Error downloading CapCut video:", error);
          send("Đã xảy ra lỗi khi tải nội dung từ CapCut.");
        }
      }
      /* Threads */
      else if (/threads\.net/.test(str)) {
        try {
          const res = await axios.get(`https://subhatde.id.vn/threads/download?url=${encodeURIComponent(str)}`);
          const data = res.data;
          if (data && data.attachments && data.attachments.length > 0) {
            let attachment = [];

            for (const media of data.attachments) {
              const mediaType = media.type === 'video' ? 'mp4' : 'jpg';
              attachment.push(await streamURL(media.url, mediaType));
            }
            send({
              body: `${head("THREADS")}📝 Tiêu đề: ${data.caption || "N/A"}\n👤 Tác giả: ${data.author || "N/A"}\n──────────────────\n📺 Đây là tính năng tự động tải khi phát hiện link Threads.`,
              attachment: attachment
            });
          } else {
            send("Không tìm thấy nội dung đính kèm từ bài đăng Threads.");
          }
        } catch (error) {
          send("Đã xảy ra lỗi khi tải nội dung từ Threads.");
        }
      }

      /* Spotify */
      else if (/open\.spotify\.com\/track\//.test(str)) {
        try {
          const res = await axios.get(`https://deku-rest-api.gleeze.com/api/spotify2?q=${encodeURIComponent(str)}`);
          const trackData = res.data.result;
          const artists = trackData.artist;
          const title = trackData.title;
          const duration = trackData.duration;
          const downloadUrl = trackData.download_url;
          if (!downloadUrl) {
            return send("Không tìm thấy URL tải nhạc.");
          }
          const filePath = `${__dirname}/cache/${title.replace(/[^\w\s]/gi, '')}.mp3`;
          const audioResponse = await axios.get(downloadUrl, { responseType: "arraybuffer" });
          fs.writeFileSync(filePath, Buffer.from(audioResponse.data));
          o.api.sendMessage(
            {
              body: `${head('SPOTIFY')}📝 Tiêu đề: ${title || "N/A"}\n👤 Tác giả: ${artists || "N/A"}\n⏰ Thời gian: ${duration}\n──────────────────\n📺 Đây là tính năng tự động tải khi phát hiện link Spotify.`,
              attachment: fs.createReadStream(filePath)
            },
            o.event.threadID,
            (error, info) => {
              if (error) return send("Đã xảy ra lỗi khi gửi nhạc.");
              fs.unlinkSync(filePath);
            },
            o.event.messageID
          );
        } catch (error) {
          send("Đã xảy ra lỗi khi tải nhạc.");
        }
      }

      /* Twitter */
      else if (/x\.com/.test(str)) {
        try {
          const res = await axios.get(`https://subhatde.id.vn/tw/download?url=${str}`);
          let attachment = [];
          if (res.data != null && res.data.media && res.data.media.length > 0) {
            for (let mediaURL of res.data.media) {
              const extension = mediaURL.split('.').pop(); 
              attachment.push(await streamURL(mediaURL, extension === 'mp4' ? 'mp4' : 'jpg'));
            }
          }
          send({
            body: `${head("TWITTER")}📝 Tiêu đề: ${res.data.title || 'N/A'}\n👤 Tác giả: ${res.data.author || 'N/A'}\n❤ Lượt thích: ${res.data.likes || 0}\n💬 Lượt Comment: ${res.data.replies || 0}\n↪ Lượt share: ${res.data.retweets || 0}\n📆 Ngày tải lên: ${res.data.date}\n──────────────────\n📺 Đây là tính năng tự động tải khi phát hiện link Twitter.`,
            attachment: attachment
          });
        } catch (error) {
          send("Đã xảy ra lỗi khi tải nội dung từ Twitter.");
        }
      }
       /* Instagram */
       else if (/instagram\.com/.test(link)) {
        try {
          const res = await axios.get(`https://subhatde.id.vn/instagram/download?link=${encodeURIComponent(link)}`);
          const data = res.data;

          if (data.attachments && data.attachments.length > 0) {
            let attachments = [];

            for (const media of data.attachments) {
              const mediaType = media.type === 'Video' ? 'mp4' : 'jpg';
              attachments.push(await streamURL(media.url, mediaType));
            }

            send({
              body: `${head("INSTAGRAM")}📝 Tiêu đề: ${data.caption || "N/A"}\n👤 Tác giả: ${data.owner.full_name || "N/A"}\n❤ Lượt thích: ${data.like_count || 0}\n💬 Lượt bình luận: ${data.comment_count || 0}\n──────────────────\n📺 Đây là tính năng tự động tải khi phát hiện link Instagram.`,
              attachment: attachments,
            });
          } else {
            send("Không tìm thấy nội dung đính kèm từ bài đăng Instagram.");
          }
        } catch (error) {
          console.error("Error downloading Instagram content:", error);
          send("Đã xảy ra lỗi khi tải nội dung từ Instagram.");
        }
      }
    }
  } catch (e) {
    send("Đã xảy ra lỗi trong quá trình xử lý yêu cầu.");
  }
};

exports.run = () => {};
exports.handleReaction = async function (o) {
  const { threadID: t, messageID: m, reaction: r } = o.event;
  const { handleReaction: _ } = o;
  if (r != "👍") return;
  o.api.sendMessage({
    body: `[ TIKTOK ] - MP3\n\n👤 ID: ${_.data.music_info.id}\n📝 Tiêu Đề: ${_.data.music_info.title}\n🔗 Link Tải: ${_.data.music_info.play}\n⏰ Time: ${_.data.music_info.duration} giây\n──────────────────\n📺 Đây là tính năng tự động tải khi bạn thả cảm xúc 👍.`,
    attachment: await streamURL(_.data.music, "mp3")
  }, t, m);
};

exports.config = {
  name: 'autodow',
  version: '2.7.1',
  hasPermssion: 0,
  credits: 'mod thập cẩm by ',
  description: 'tự động tải link',
  commandCategory: 'Tiện ích',
  usages: [],
  cooldowns: 3
};

function streamURL(url, type) {
  return axios.get(url, { responseType: 'arraybuffer' }).then(res => {
    const path = `${__dirname}/cache/${Date.now()}.${type}`;
    fs.writeFileSync(path, res.data);
    setTimeout(p => fs.unlinkSync(p), 1000 * 60, path);
    return fs.createReadStream(path);
  });
}

function infoPostTT(url) {
  return axios({
    method: 'post',
    url: `https://tikwm.com/api/`,
    data: { url },
    headers: { 'content-type': 'application/json' }
  }).then(res => res.data.data);
}

function checkLink(url) {
  const regex = /(?:(?:https?|ftp|file):\/\/|www\.|ftp\.)(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[-A-Z0-9+&@#\/%=~_|$?!:,.])*(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[A-Z0-9+&@#\/%=~_|$])/igm;
  const found = (url).match(regex);
  var media = ['vt', 'tiktok', 'facebook', 'douyin', 'youtube', 'youtu', 'twitter', 'instagram', 'kuaishou', 'fb'];
  if (isVaildUrl(String(found))) {
    if (media.some(item => String(found).includes(item))) {
      return { type: "mp4", url: String(found) };
    } else if (String(found).includes("soundcloud") || String(found).includes("zingmp3")) {
      return { type: "mp3", url: String(found) };
    }
  }
  return !1;
}

function isVaildUrl(url) {
  const regex = /(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g;
  return !!url.match(regex);
}

async function handleYouTubeMedia(res, send) {
  let attachment = [];
  const head = `[ YOUTUBER ] - Download\n\n`;
  try {
    const videoUrl = res.url;
    attachment.push(await streamURL(videoUrl, "mp4"));
    send({
      body: `${head}👤 Tác Giả: ${res.author || "N/A"}\n📝 Tiêu Đề: ${res.title || "N/A"}\n⏳ Thời Gian: ${res.duration || "N/A"}\n──────────────────\n📺 Đây là tính năng tự động tải khi phát hiện link YouTube.`,
      attachment,
    });
  } catch (error) {
    console.error("Error processing YouTube media:", error);
    send("Đã xảy ra lỗi khi xử lý media từ YouTube. Vui lòng thử lại sau!");
  }
}

async function downloadSoundCloud(url, type, api, event, send) {
  try {
    const res = await axios.get(`https://nguyenmanh.name.vn/api/scDL?url=${url}&apikey=${scApi}`);
    const { result } = res.data;
    const path = `${__dirname}/cache/${Date.now()}.${type}`;
    
    axios({
      method: "GET",
      url: type === "mp3" ? result.audio : url,
      responseType: "arraybuffer"
    }).then(res => {
      fs.writeFileSync(path, Buffer.from(res.data));
      api.sendMessage({
        body: `[ SOUNDCLOUD ] - Download\n\n📝 Tiêu Đề: ${result.title}\nMiêu tả: ${result.data.description}\n👍 Like: ${result.data.likes_count}\n💬 Comment: ${result.data.comment_count}\n⏰ Time: ${result.duration}\n──────────────────\n📺 Đây là tính năng tự động tải khi phát hiện link SoundCloud.`,
        attachment: fs.createReadStream(path)
      }, event.threadID, () => fs.unlinkSync(path), event.messageID);
    });
  } catch (err) {
    send("Không thể tải xuống từ SoundCloud.");
    console.error("Error downloading SoundCloud content:", err);
  }
}
