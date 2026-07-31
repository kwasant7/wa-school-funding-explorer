/**
 * Static assistant copy in every language the site supports.
 *
 * The site translates itself by swapping text nodes against a generated
 * dictionary. That mechanism cannot be used here for two reasons: the
 * assistant's replies are generated per visitor and will never be in any
 * dictionary, and its labels change while a request is in flight. So the
 * assistant subtree is marked `data-no-translate` and owns its own strings.
 *
 * The visitor's language is also sent to the model, which answers in it - so
 * a reply arrives already translated rather than being post-processed.
 */
import type { AssistantLanguage } from '@/lib/assistant/types';

export type AssistantStrings = {
  open: string;
  close: string;
  title: string;
  subtitle: string;
  placeholder: string;
  send: string;
  stop: string;
  newConversation: string;
  retry: string;
  sources: string;
  suggestions: string;
  starters: string;
  loading: string;
  disclaimer: string;
  welcome: string;
  performed: string;
  offer: string;
  errorGeneric: string;
  errorNotConfigured: string;
  errorNetwork: string;
  errorTimeout: string;
  errorRateLimited: string;
  errorInvalid: string;
  errorActionRefused: string;
  messagesLabel: string;
  externalLink: string;
  confidenceLow: string;
  /** Action confirmation templates. {x} and {y} are substituted. */
  actionGoTo: string;
  actionScroll: string;
  actionHighlight: string;
  actionSelectDistrict: string;
  actionClearDistrict: string;
  actionSetYear: string;
  actionSetControl: string;
  actionReset: string;
  actionOpenSource: string;
  pageHome: string;
  pageDistricts: string;
  pageSimulator: string;
  pageTakeAction: string;
  pageSources: string;
  pageLea: string;
};

const en: AssistantStrings = {
  open: 'Open the site guide',
  close: 'Close the site guide',
  title: 'Site guide',
  subtitle: 'Ask about this site or Washington school funding',
  placeholder: 'Ask a question…',
  send: 'Send',
  stop: 'Stop',
  newConversation: 'New conversation',
  retry: 'Try again',
  sources: 'Sources',
  suggestions: 'Ask next',
  starters: 'Try asking',
  loading: 'Thinking…',
  disclaimer:
    'This guide explains the educational content and data on this website. It is not an official fiscal or legal source.',
  welcome:
    'I can explain how this site works and what Washington’s school funding data shows. I use only this site’s own data and sources.',
  performed: 'Done',
  offer: 'Do this',
  errorGeneric: 'The site guide is temporarily unavailable.',
  errorNotConfigured: 'The site guide has not been set up yet.',
  errorNetwork: 'Could not reach the site guide. Check your connection.',
  errorTimeout: 'That took too long. Please try again.',
  errorRateLimited:
    'You’ve sent several questions quickly. Please wait a moment and try again.',
  errorInvalid: 'I couldn’t produce a reliable answer to that. Try rephrasing.',
  errorActionRefused: 'I couldn’t verify that change, so I left the page as it is.',
  messagesLabel: 'Conversation',
  externalLink: 'opens in a new tab',
  confidenceLow: 'This site’s data may not fully cover that — verify with the sources.',
  actionGoTo: 'Go to {x}',
  actionScroll: 'Scroll to {x}',
  actionHighlight: 'Highlight {x}',
  actionSelectDistrict: 'Select {x}',
  actionClearDistrict: 'Clear the selected district',
  actionSetYear: 'Switch to {x}',
  actionSetControl: 'Set {x} to {y}',
  actionReset: 'Reset the simulator to current law',
  actionOpenSource: 'Open {x}',
  pageHome: 'How It Works',
  pageDistricts: 'District Explorer',
  pageSimulator: 'Policy Simulator',
  pageTakeAction: 'Take Action',
  pageSources: 'Sources & Methodology',
  pageLea: 'Local Effort Assistance',
};

const es: AssistantStrings = {
  open: 'Abrir la guía del sitio',
  close: 'Cerrar la guía del sitio',
  title: 'Guía del sitio',
  subtitle: 'Pregunta sobre este sitio o la financiación escolar de Washington',
  placeholder: 'Haz una pregunta…',
  send: 'Enviar',
  stop: 'Detener',
  newConversation: 'Nueva conversación',
  retry: 'Intentar de nuevo',
  sources: 'Fuentes',
  suggestions: 'Pregunta ahora',
  starters: 'Prueba a preguntar',
  loading: 'Pensando…',
  disclaimer:
    'Esta guía explica el contenido educativo y los datos de este sitio web. No es una fuente fiscal ni legal oficial.',
  welcome:
    'Puedo explicar cómo funciona este sitio y qué muestran los datos de financiación escolar de Washington. Solo uso los datos y las fuentes de este sitio.',
  performed: 'Hecho',
  offer: 'Hacer esto',
  errorGeneric: 'La guía del sitio no está disponible temporalmente.',
  errorNotConfigured: 'La guía del sitio aún no está configurada.',
  errorNetwork: 'No se pudo conectar con la guía del sitio. Revisa tu conexión.',
  errorTimeout: 'Tardó demasiado. Inténtalo de nuevo.',
  errorRateLimited:
    'Has enviado varias preguntas muy rápido. Espera un momento e inténtalo de nuevo.',
  errorInvalid: 'No pude dar una respuesta fiable. Prueba a reformular la pregunta.',
  errorActionRefused: 'No pude verificar ese cambio, así que dejé la página igual.',
  messagesLabel: 'Conversación',
  externalLink: 'se abre en una pestaña nueva',
  confidenceLow:
    'Puede que los datos de este sitio no cubran eso del todo: verifícalo con las fuentes.',
  actionGoTo: 'Ir a {x}',
  actionScroll: 'Desplazarse a {x}',
  actionHighlight: 'Resaltar {x}',
  actionSelectDistrict: 'Seleccionar {x}',
  actionClearDistrict: 'Quitar el distrito seleccionado',
  actionSetYear: 'Cambiar a {x}',
  actionSetControl: 'Establecer {x} en {y}',
  actionReset: 'Restablecer el simulador a la ley actual',
  actionOpenSource: 'Abrir {x}',
  pageHome: 'Cómo funciona',
  pageDistricts: 'Explorador del distrito',
  pageSimulator: 'Simulador de políticas',
  pageTakeAction: 'Tomar medidas',
  pageSources: 'Fuentes y metodología',
  pageLea: 'Asistencia al Esfuerzo Local',
};

const zh: AssistantStrings = {
  open: '打开网站指南',
  close: '关闭网站指南',
  title: '网站指南',
  subtitle: '询问本网站或华盛顿州学校经费的问题',
  placeholder: '提出问题…',
  send: '发送',
  stop: '停止',
  newConversation: '新对话',
  retry: '重试',
  sources: '来源',
  suggestions: '接着问',
  starters: '试着问',
  loading: '思考中…',
  disclaimer: '本指南解释此网站上的教育内容和数据，并非官方财政或法律来源。',
  welcome:
    '我可以说明本网站的用法，以及华盛顿州学校经费数据的含义。我只使用本网站自身的数据和来源。',
  performed: '已完成',
  offer: '执行此操作',
  errorGeneric: '网站指南暂时无法使用。',
  errorNotConfigured: '网站指南尚未设置。',
  errorNetwork: '无法连接网站指南，请检查网络连接。',
  errorTimeout: '耗时过长，请重试。',
  errorRateLimited: '您在短时间内提出了多个问题，请稍候再试。',
  errorInvalid: '我无法给出可靠的回答，请换一种说法。',
  errorActionRefused: '我无法验证该操作，因此没有更改页面。',
  messagesLabel: '对话',
  externalLink: '在新标签页中打开',
  confidenceLow: '本网站的数据可能未完全涵盖该问题，请通过来源核实。',
  actionGoTo: '前往{x}',
  actionScroll: '滚动到{x}',
  actionHighlight: '高亮{x}',
  actionSelectDistrict: '选择{x}',
  actionClearDistrict: '清除所选学区',
  actionSetYear: '切换到{x}',
  actionSetControl: '将{x}设置为{y}',
  actionReset: '将模拟器重置为现行法律',
  actionOpenSource: '打开{x}',
  pageHome: '运作方式',
  pageDistricts: '学区浏览器',
  pageSimulator: '政策模拟器',
  pageTakeAction: '采取行动',
  pageSources: '来源与方法',
  pageLea: '地方努力补助',
};

const vi: AssistantStrings = {
  open: 'Mở hướng dẫn trang web',
  close: 'Đóng hướng dẫn trang web',
  title: 'Hướng dẫn trang web',
  subtitle: 'Hỏi về trang web này hoặc kinh phí trường học Washington',
  placeholder: 'Đặt câu hỏi…',
  send: 'Gửi',
  stop: 'Dừng',
  newConversation: 'Cuộc trò chuyện mới',
  retry: 'Thử lại',
  sources: 'Nguồn',
  suggestions: 'Hỏi tiếp',
  starters: 'Thử hỏi',
  loading: 'Đang suy nghĩ…',
  disclaimer:
    'Hướng dẫn này giải thích nội dung giáo dục và dữ liệu trên trang web. Đây không phải nguồn tài chính hay pháp lý chính thức.',
  welcome:
    'Tôi có thể giải thích cách sử dụng trang web này và ý nghĩa của dữ liệu kinh phí trường học Washington. Tôi chỉ dùng dữ liệu và nguồn của chính trang web này.',
  performed: 'Đã xong',
  offer: 'Thực hiện',
  errorGeneric: 'Hướng dẫn trang web tạm thời không khả dụng.',
  errorNotConfigured: 'Hướng dẫn trang web chưa được thiết lập.',
  errorNetwork: 'Không kết nối được với hướng dẫn. Vui lòng kiểm tra mạng.',
  errorTimeout: 'Quá lâu. Vui lòng thử lại.',
  errorRateLimited: 'Bạn đã gửi nhiều câu hỏi liên tiếp. Vui lòng đợi một lát rồi thử lại.',
  errorInvalid: 'Tôi không thể đưa ra câu trả lời đáng tin cậy. Hãy thử diễn đạt lại.',
  errorActionRefused: 'Tôi không xác minh được thay đổi đó nên đã giữ nguyên trang.',
  messagesLabel: 'Cuộc trò chuyện',
  externalLink: 'mở trong tab mới',
  confidenceLow:
    'Dữ liệu của trang web có thể chưa bao quát hết điều đó — hãy kiểm chứng bằng các nguồn.',
  actionGoTo: 'Đi tới {x}',
  actionScroll: 'Cuộn đến {x}',
  actionHighlight: 'Làm nổi bật {x}',
  actionSelectDistrict: 'Chọn {x}',
  actionClearDistrict: 'Bỏ chọn học khu',
  actionSetYear: 'Chuyển sang {x}',
  actionSetControl: 'Đặt {x} thành {y}',
  actionReset: 'Đặt lại trình mô phỏng về luật hiện hành',
  actionOpenSource: 'Mở {x}',
  pageHome: 'Cách hoạt động',
  pageDistricts: 'Khám phá học khu',
  pageSimulator: 'Trình mô phỏng chính sách',
  pageTakeAction: 'Hành động',
  pageSources: 'Nguồn và phương pháp',
  pageLea: 'Hỗ trợ Nỗ lực Địa phương',
};

const ru: AssistantStrings = {
  open: 'Открыть справку по сайту',
  close: 'Закрыть справку по сайту',
  title: 'Справка по сайту',
  subtitle: 'Спросите о сайте или финансировании школ Вашингтона',
  placeholder: 'Задайте вопрос…',
  send: 'Отправить',
  stop: 'Стоп',
  newConversation: 'Новый разговор',
  retry: 'Повторить',
  sources: 'Источники',
  suggestions: 'Спросите далее',
  starters: 'Попробуйте спросить',
  loading: 'Думаю…',
  disclaimer:
    'Этот помощник объясняет образовательные материалы и данные сайта. Это не официальный финансовый или юридический источник.',
  welcome:
    'Я объясню, как устроен сайт и что показывают данные о финансировании школ Вашингтона. Я использую только данные и источники этого сайта.',
  performed: 'Готово',
  offer: 'Выполнить',
  errorGeneric: 'Справка по сайту временно недоступна.',
  errorNotConfigured: 'Справка по сайту ещё не настроена.',
  errorNetwork: 'Не удалось связаться со справкой. Проверьте подключение.',
  errorTimeout: 'Слишком долго. Попробуйте ещё раз.',
  errorRateLimited: 'Вы отправили несколько вопросов подряд. Подождите немного и повторите.',
  errorInvalid: 'Не удалось дать надёжный ответ. Попробуйте переформулировать.',
  errorActionRefused: 'Не удалось проверить это действие, поэтому страница не изменена.',
  messagesLabel: 'Разговор',
  externalLink: 'откроется в новой вкладке',
  confidenceLow:
    'Данные сайта могут не полностью охватывать этот вопрос — проверьте по источникам.',
  actionGoTo: 'Перейти к {x}',
  actionScroll: 'Прокрутить к {x}',
  actionHighlight: 'Выделить {x}',
  actionSelectDistrict: 'Выбрать {x}',
  actionClearDistrict: 'Сбросить выбранный округ',
  actionSetYear: 'Переключить на {x}',
  actionSetControl: 'Установить {x} на {y}',
  actionReset: 'Сбросить симулятор к действующему закону',
  actionOpenSource: 'Открыть {x}',
  pageHome: 'Как это работает',
  pageDistricts: 'Обзор округов',
  pageSimulator: 'Симулятор политики',
  pageTakeAction: 'Действовать',
  pageSources: 'Источники и методология',
  pageLea: 'Local Effort Assistance',
};

const tl: AssistantStrings = {
  open: 'Buksan ang gabay sa site',
  close: 'Isara ang gabay sa site',
  title: 'Gabay sa site',
  subtitle: 'Magtanong tungkol sa site na ito o sa pondo ng paaralan sa Washington',
  placeholder: 'Magtanong…',
  send: 'Ipadala',
  stop: 'Itigil',
  newConversation: 'Bagong usapan',
  retry: 'Subukang muli',
  sources: 'Mga pinagkunan',
  suggestions: 'Itanong sunod',
  starters: 'Subukang itanong',
  loading: 'Nag-iisip…',
  disclaimer:
    'Ipinapaliwanag ng gabay na ito ang nilalamang pang-edukasyon at datos sa website na ito. Hindi ito opisyal na pinagkukunang piskal o legal.',
  welcome:
    'Maipapaliwanag ko kung paano gamitin ang site na ito at kung ano ang ipinapakita ng datos ng pondo ng paaralan sa Washington. Datos at pinagkunan lamang ng site na ito ang ginagamit ko.',
  performed: 'Tapos na',
  offer: 'Gawin ito',
  errorGeneric: 'Pansamantalang hindi magamit ang gabay sa site.',
  errorNotConfigured: 'Hindi pa nakaset up ang gabay sa site.',
  errorNetwork: 'Hindi maabot ang gabay sa site. Suriin ang iyong koneksyon.',
  errorTimeout: 'Masyadong matagal. Pakisubukang muli.',
  errorRateLimited:
    'Marami kang naipadalang tanong nang mabilis. Maghintay saglit at subukang muli.',
  errorInvalid: 'Hindi ako makapagbigay ng maaasahang sagot. Subukang baguhin ang tanong.',
  errorActionRefused:
    'Hindi ko na-verify ang pagbabagong iyon, kaya hindi ko binago ang pahina.',
  messagesLabel: 'Usapan',
  externalLink: 'bubukas sa bagong tab',
  confidenceLow:
    'Maaaring hindi lubos na saklaw ng datos ng site na ito iyon — i-verify sa mga pinagkunan.',
  actionGoTo: 'Pumunta sa {x}',
  actionScroll: 'Mag-scroll sa {x}',
  actionHighlight: 'I-highlight ang {x}',
  actionSelectDistrict: 'Piliin ang {x}',
  actionClearDistrict: 'Alisin ang napiling distrito',
  actionSetYear: 'Lumipat sa {x}',
  actionSetControl: 'Itakda ang {x} sa {y}',
  actionReset: 'I-reset ang simulator sa kasalukuyang batas',
  actionOpenSource: 'Buksan ang {x}',
  pageHome: 'Paano Ito Gumagana',
  pageDistricts: 'Explorer ng Distrito',
  pageSimulator: 'Simulator ng Patakaran',
  pageTakeAction: 'Kumilos',
  pageSources: 'Mga Pinagkunan at Metodolohiya',
  pageLea: 'Local Effort Assistance',
};

const ko: AssistantStrings = {
  open: '사이트 가이드 열기',
  close: '사이트 가이드 닫기',
  title: '사이트 가이드',
  subtitle: '이 사이트나 워싱턴주 학교 재정에 대해 물어보세요',
  placeholder: '질문을 입력하세요…',
  send: '보내기',
  stop: '중지',
  newConversation: '새 대화',
  retry: '다시 시도',
  sources: '출처',
  suggestions: '이어서 질문하기',
  starters: '이렇게 물어보세요',
  loading: '생각 중…',
  disclaimer:
    '이 가이드는 본 웹사이트의 교육 콘텐츠와 데이터를 설명합니다. 공식 재정 또는 법률 자료가 아닙니다.',
  welcome:
    '이 사이트의 사용법과 워싱턴주 학교 재정 데이터의 의미를 설명해 드립니다. 본 사이트의 데이터와 출처만 사용합니다.',
  performed: '완료',
  offer: '실행하기',
  errorGeneric: '사이트 가이드를 일시적으로 사용할 수 없습니다.',
  errorNotConfigured: '사이트 가이드가 아직 설정되지 않았습니다.',
  errorNetwork: '사이트 가이드에 연결할 수 없습니다. 연결 상태를 확인하세요.',
  errorTimeout: '시간이 너무 오래 걸렸습니다. 다시 시도해 주세요.',
  errorRateLimited: '짧은 시간에 여러 질문을 보내셨습니다. 잠시 후 다시 시도해 주세요.',
  errorInvalid: '신뢰할 수 있는 답변을 드리지 못했습니다. 다르게 표현해 보세요.',
  errorActionRefused: '해당 변경을 확인할 수 없어 페이지를 변경하지 않았습니다.',
  messagesLabel: '대화',
  externalLink: '새 탭에서 열림',
  confidenceLow: '이 사이트의 데이터가 해당 내용을 충분히 다루지 않을 수 있습니다. 출처로 확인하세요.',
  actionGoTo: '{x}(으)로 이동',
  actionScroll: '{x}(으)로 스크롤',
  actionHighlight: '{x} 강조',
  actionSelectDistrict: '{x} 선택',
  actionClearDistrict: '선택한 학군 해제',
  actionSetYear: '{x}(으)로 전환',
  actionSetControl: '{x}을(를) {y}(으)로 설정',
  actionReset: '시뮬레이터를 현행법으로 초기화',
  actionOpenSource: '{x} 열기',
  pageHome: '작동 방식',
  pageDistricts: '학군 탐색기',
  pageSimulator: '정책 시뮬레이터',
  pageTakeAction: '행동하기',
  pageSources: '출처 및 방법론',
  pageLea: 'Local Effort Assistance',
};

const STRINGS: Record<AssistantLanguage, AssistantStrings> = { en, es, zh, vi, ru, tl, ko };

export function assistantStrings(language: AssistantLanguage): AssistantStrings {
  return STRINGS[language] ?? en;
}

/* ------------------------------------------------------------------ *
 * Starter questions
 * ------------------------------------------------------------------ */

export type StarterKey = 'home' | 'districts' | 'simulator' | 'takeAction' | 'sources' | 'lea';

const STARTERS: Record<AssistantLanguage, Record<StarterKey, string[]>> = {
  en: {
    home: [
      'How does Washington’s prototypical school model work?',
      'Why does this site use funding FTE?',
      'Help me find my school district.',
    ],
    districts: [
      'Explain this district’s funding sources.',
      'How does this district compare with the state average?',
      'What does per-student funding include?',
    ],
    simulator: [
      'What does this simulator estimate?',
      'Explain Local Effort Assistance.',
      'Which setting has the largest statewide effect?',
    ],
    takeAction: [
      'How do I contact my legislators?',
      'How can a student testify?',
      'Help me understand these policy choices.',
    ],
    sources: [
      'Where do the district numbers come from?',
      'Why are two enrollment measures used?',
      'How can I verify a number?',
    ],
    lea: [
      'Explain Local Effort Assistance simply.',
      'Why does the LEA goal move?',
      'Which districts get the most equalization?',
    ],
  },
  es: {
    home: [
      '¿Cómo funciona el modelo de escuela prototípica de Washington?',
      '¿Por qué este sitio usa el FTE de financiación?',
      'Ayúdame a encontrar mi distrito escolar.',
    ],
    districts: [
      'Explica las fuentes de financiación de este distrito.',
      '¿Cómo se compara este distrito con la media estatal?',
      '¿Qué incluye la financiación por estudiante?',
    ],
    simulator: [
      '¿Qué estima este simulador?',
      'Explica la Asistencia al Esfuerzo Local (LEA).',
      '¿Qué ajuste tiene el mayor efecto estatal?',
    ],
    takeAction: [
      '¿Cómo contacto a mis legisladores?',
      '¿Cómo puede testificar un estudiante?',
      'Ayúdame a entender estas opciones de política.',
    ],
    sources: [
      '¿De dónde salen las cifras de los distritos?',
      '¿Por qué se usan dos medidas de matrícula?',
      '¿Cómo puedo verificar una cifra?',
    ],
    lea: [
      'Explica la Asistencia al Esfuerzo Local de forma sencilla.',
      '¿Por qué cambia la meta de LEA?',
      '¿Qué distritos reciben más equalización?',
    ],
  },
  zh: {
    home: [
      '华盛顿州的“原型学校”经费模式如何运作？',
      '本网站为何使用经费 FTE？',
      '帮我找到我的学区。',
    ],
    districts: [
      '说明这个学区的经费来源。',
      '这个学区与全州平均水平相比如何？',
      '每名学生的经费包含哪些内容？',
    ],
    simulator: [
      '这个模拟器估算什么？',
      '解释地方努力补助（LEA）。',
      '哪个设置对全州影响最大？',
    ],
    takeAction: [
      '我如何联系我的议员？',
      '学生如何出席作证？',
      '帮我理解这些政策选项。',
    ],
    sources: [
      '学区数字来自哪里？',
      '为什么使用两种入学人数统计？',
      '我如何核实某个数字？',
    ],
    lea: [
      '用简单的话解释地方努力补助。',
      'LEA 的目标值为何会变动？',
      '哪些学区获得最多的均衡补助？',
    ],
  },
  vi: {
    home: [
      'Mô hình trường học nguyên mẫu của Washington hoạt động ra sao?',
      'Vì sao trang web dùng FTE kinh phí?',
      'Giúp tôi tìm học khu của mình.',
    ],
    districts: [
      'Giải thích các nguồn kinh phí của học khu này.',
      'Học khu này so với mức trung bình toàn bang thế nào?',
      'Kinh phí trên mỗi học sinh gồm những gì?',
    ],
    simulator: [
      'Trình mô phỏng này ước tính điều gì?',
      'Giải thích Hỗ trợ Nỗ lực Địa phương (LEA).',
      'Thiết lập nào có tác động lớn nhất toàn bang?',
    ],
    takeAction: [
      'Làm sao để liên hệ với dân biểu của tôi?',
      'Học sinh có thể điều trần bằng cách nào?',
      'Giúp tôi hiểu các lựa chọn chính sách này.',
    ],
    sources: [
      'Các con số của học khu lấy từ đâu?',
      'Vì sao dùng hai cách đo số học sinh?',
      'Làm sao tôi kiểm chứng một con số?',
    ],
    lea: [
      'Giải thích đơn giản về Hỗ trợ Nỗ lực Địa phương.',
      'Vì sao mục tiêu LEA thay đổi?',
      'Học khu nào nhận nhiều hỗ trợ cân bằng nhất?',
    ],
  },
  ru: {
    home: [
      'Как работает модель «типовой школы» в Вашингтоне?',
      'Почему сайт использует финансовый FTE?',
      'Помогите найти мой школьный округ.',
    ],
    districts: [
      'Объясните источники финансирования этого округа.',
      'Как этот округ выглядит на фоне среднего по штату?',
      'Что входит в финансирование на одного ученика?',
    ],
    simulator: [
      'Что оценивает этот симулятор?',
      'Объясните Local Effort Assistance.',
      'Какая настройка сильнее всего влияет на весь штат?',
    ],
    takeAction: [
      'Как связаться с моими законодателями?',
      'Как школьник может выступить на слушании?',
      'Помогите разобраться в этих вариантах политики.',
    ],
    sources: [
      'Откуда взяты цифры по округам?',
      'Почему используются два показателя численности?',
      'Как проверить конкретную цифру?',
    ],
    lea: [
      'Объясните Local Effort Assistance простыми словами.',
      'Почему меняется целевой уровень LEA?',
      'Какие округа получают больше всего выравнивания?',
    ],
  },
  tl: {
    home: [
      'Paano gumagana ang prototypical school model ng Washington?',
      'Bakit gumagamit ang site na ito ng funding FTE?',
      'Tulungan akong hanapin ang aking school district.',
    ],
    districts: [
      'Ipaliwanag ang mga pinagkukunan ng pondo ng distritong ito.',
      'Paano ikinukumpara ang distritong ito sa average ng estado?',
      'Ano ang kasama sa pondo bawat mag-aaral?',
    ],
    simulator: [
      'Ano ang tinatantiya ng simulator na ito?',
      'Ipaliwanag ang Local Effort Assistance.',
      'Aling setting ang may pinakamalaking epekto sa buong estado?',
    ],
    takeAction: [
      'Paano ko makokontak ang aking mga mambabatas?',
      'Paano makakapagtestigo ang isang mag-aaral?',
      'Tulungan akong maintindihan ang mga pagpipiliang patakaran.',
    ],
    sources: [
      'Saan nanggaling ang mga numero ng distrito?',
      'Bakit dalawang sukat ng enrollment ang ginagamit?',
      'Paano ko mave-verify ang isang numero?',
    ],
    lea: [
      'Ipaliwanag nang simple ang Local Effort Assistance.',
      'Bakit nagbabago ang target ng LEA?',
      'Aling mga distrito ang pinakamaraming natatanggap na equalization?',
    ],
  },
  ko: {
    home: [
      '워싱턴주의 표준 학교 모델은 어떻게 작동하나요?',
      '이 사이트는 왜 재정 FTE를 사용하나요?',
      '우리 학군을 찾도록 도와주세요.',
    ],
    districts: [
      '이 학군의 재원 구성을 설명해 주세요.',
      '이 학군은 주 평균과 비교하면 어떤가요?',
      '학생 1인당 재정에는 무엇이 포함되나요?',
    ],
    simulator: [
      '이 시뮬레이터는 무엇을 추정하나요?',
      'Local Effort Assistance를 설명해 주세요.',
      '어떤 설정이 주 전체에 가장 큰 영향을 주나요?',
    ],
    takeAction: [
      '지역 의원에게 어떻게 연락하나요?',
      '학생은 어떻게 공청회에서 발언할 수 있나요?',
      '이 정책 선택지들을 이해하도록 도와주세요.',
    ],
    sources: [
      '학군 수치는 어디에서 오나요?',
      '왜 두 가지 학생 수 지표를 사용하나요?',
      '특정 수치를 어떻게 검증하나요?',
    ],
    lea: [
      'Local Effort Assistance를 쉽게 설명해 주세요.',
      'LEA 목표액은 왜 변하나요?',
      '어떤 학군이 평준화 지원을 가장 많이 받나요?',
    ],
  },
};

export function starterQuestions(
  language: AssistantLanguage,
  key: StarterKey
): string[] {
  return STARTERS[language]?.[key] ?? STARTERS.en[key];
}

/** Which starter set belongs to a pathname, ignoring the deploy base path. */
export function starterKeyForPath(pathname: string): StarterKey {
  const path = pathname.replace(/\/+$/, '');
  if (path.endsWith('/districts')) return 'districts';
  if (path.endsWith('/simulator')) return 'simulator';
  if (path.endsWith('/take-action')) return 'takeAction';
  if (path.endsWith('/sources')) return 'sources';
  if (path.endsWith('/lea')) return 'lea';
  return 'home';
}
