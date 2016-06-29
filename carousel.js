


$('.exe_button_1').hide();
$('.exe_button_2').hide();
$('.exe_button_3').hide();
$('.exe_button_disabled').hide();
$('.reload_button_disabled').hide();
$('.reload_exe').hide();
$('.disabledButtonMessage').hide();
$('.disabledButtonReload').hide();


// adds swipe function together with "carousel-swipe.js"
// $("#myCarousel").carousel(function(){});

$("#myCarousel").swiperight(function() {
  // console.log('right');
  $("#myCarousel").carousel('prev');
  var activeMenuItem = $('.nav').find('li.active');
  var navNumber = activeMenuItem.data('slide-to');
  activeMenuItem.removeClass('active');
  var nextMenuItem;

  // console.log('if number:', navNumber - 1);

  if ((navNumber - 1) < 0) {
    nextMenuItem = $('.nav').find('[data-slide-to="2"]');
  }
  else {
    nextMenuItem = $('.nav').find('[data-slide-to="' + (navNumber - 1) + '"]');
  }
  nextMenuItem.addClass('active');

  // console.log('navNumber: ', navNumber);
});
$("#myCarousel").swipeleft(function() {
  $("#myCarousel").carousel('next');
  var activeMenuItem = $('.nav').find('li.active');
  var navNumber = activeMenuItem.data('slide-to');
  activeMenuItem.removeClass('active');
  var nextMenuItem;

  // console.log('if number:', navNumber + 1);

  if ((navNumber + 1) > 2) {
    nextMenuItem = $('.nav').find('[data-slide-to="0"]');
  }
  else {
    nextMenuItem = $('.nav').find('[data-slide-to="' + (navNumber + 1) + '"]');
  }
  nextMenuItem.addClass('active');
});


$('.nav li').click(function(){
  $(this).toggleClass("active");
  $(this).siblings().removeClass('active');
});



// $(window).resize(function(){
//   if ($(window).width() > 1025) {

//     // $('#chatDiv').append('<div id="chatlioWidgetPlaceholder" class="chatlioDiv" style="margin: auto;"></div>');

//     $('#putMeInside').append('<script src="chatlio.js"></script>');
//   }
// }).resize();



$(window).resize(function(){
  if ($(window).width() < 1025) {
    var cnt = $(".desktopOnly").contents();
    $(".desktopOnly").replaceWith(cnt);

    // $('#chatDiv').insertBefore('.beforeDiv');
    $( ".logDiv" ).appendTo( $( ".ideDiv" ) );
    // $('#putMeInside').append('<script src="chatlio.js"></script>');
    // $('#chatDiv').append('<div id="chatlioWidgetPlaceholder" class="chatlioDiv" style="margin: auto;"></div>');
    // $('#putMeInside').append('<script src="chatlio.js"></script>');

    // var removeChat = $("#chatlioWidgetPlaceholder").contents();
    // $("#chatlioWidgetPlaceholder").replaceWith(removeChat);

    // $('#chatlioWidgetPlaceholder').remove();
    // $('#chatDiv').append('<div id="chatlioWidgetPlaceholder" class="chatlioDiv" style="margin: auto;"></div>');
    // $('.chatDiv').detach().insertBefore('.beforeDiv');

    // $('.ideDiv').before('.beforeDiv');

    // $('.chatDiv').each(function() {
    //     $(this).insertAfter($(this).parent().find('.ideDiv'));
    // });
    // $( ".logDiv" ).appendTo( '$( ".ideDiv" ');
  }
  // chatlioStart();
}).resize();




$(window).resize(function(){
  if ($(window).width() < 645 && $(window).width() > 365) {
    $('.modal-footer').css('padding', '0');
    // $('.newsletterButton').css('bottom', '50');
  }
}).resize();






$(window).resize(function(){
  if ($(window).width() > 1025) {

    $("body").click(function(e) {
        // alert("clicked");
      if (e.target.id == "chatlioWidgetPlaceholder" || $(e.target).parents("#chatlioWidgetPlaceholder").size()) {
        $('.chatDiv').css('background-color', '#f95c3d');
        $('.ideDiv').css('background-color', '#10232e');
        // alert("Inside chatDiv");
      } else {
        $('.chatDiv').css('background-color', '#10232e');
        $('.ideDiv').css('background-color', '#f95c3d');
        // $buttonBoolean = false;
        // alert("Inside ideDiv");
      }


      if (e.target.id == "exec_button" || $(e.target).parents(".exec_button").size()) {
        $('.chatDiv').css('background-color', '#10232e');
        $('.ideDiv').css('background-color', '#10232e');
        // alert("Inside chatDiv");
      }
      // if($('#myModal').css('display') === 'block'){
      //   console.log("heelooo");
      // }
    });
  }
}).resize();


// function validateEmail() {
//     var x = document.forms["newsletterForm"]["eMail"].value;
//     if (x === null || x === "") {
//         alert("E-mail must be filled out");
//         return false;
//     }
// }




