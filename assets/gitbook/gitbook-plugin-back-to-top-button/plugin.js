require([
    'gitbook',
    'jquery'
], function(gitbook, $) {
    gitbook.events.on('page.change', function() {
        function smoothScrollToTop() {
            const scrollBody = document.querySelector('html');
            if (scrollBody) {
                scrollBody.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            }
        }
        const h1 = document.querySelector('.book-header h1');
        if (h1) {
            h1.addEventListener('click', function (event) {
                event.preventDefault();
                smoothScrollToTop();
            });
        }
    });
    // gitbook.events.on('page.change', function() {
    //     var back_to_top_button = ['<div class="back-to-top"><span class="material-symbols-rounded">arrow_upward</span></div>'].join("");
    //     $(".page-wrapper").append(back_to_top_button)
    
    //     $(".back-to-top").hide();

    //     $(".back-to-top").hover(function() {
    //         $(this).css('cursor', 'pointer').attr('title', 'Back to top');
    //     }, function() {
    //         $(this).css('cursor', 'auto');
    //     });
    
    //     $('.book-body,.body-inner,.page-wrapper').on('scroll', function () {
    //         if ($(this).scrollTop() > 100) { 
    //             $('.back-to-top').fadeIn();
    //         } else {
    //             $('.back-to-top').fadeOut();
    //         }
    //     });
    
    //     $('.back-to-top').on('click', function () { 
    //         $('.book-body,.body-inner').animate({
    //             scrollTop: 0
    //         }, 800);
    //         return false;
    //     });
    // });
});