## :earth_asia: 개발 환경 및 사용 언어
- Android Studio Bumblebee | 2021.1.1 Patch 3
- JAVA    



## 🎥 시연영상
#### https://youtu.be/8aQfdoAk8TM    



## :iphone: Sdk Version
- minSdkVersion : 28
- targetSdkVersion : 32    



## :wrench: Dependencies
#### :point_right: Design, Layout, etc
    > RecyclerView, GridLayout, Circled ImageView 커스텀 위해 사용
    implementation 'androidx.recyclerview:recyclerview:1.2.1'
    implementation 'androidx.gridlayout:gridlayout:1.0.0'
    implementation 'de.hdodenhof:circleimageview:3.1.0'
    
    > 이미지 로딩을 위해 사용
    implementation 'com.github.bumptech.glide:glide:4.11.0'
    annotationProcessor 'com.github.bumptech.glide:compiler:4.11.0'

#### :point_right: 서버 통신(Retrofit2 사용)
     > Rest API 이용한 서버통신을 위해 사용
     implementation 'com.squareup.retrofit2:converter-gson:2.9.0'
     implementation 'com.squareup.retrofit2:retrofit:2.9.0'
     implementation 'com.google.code.gson:gson:2.8.9'

     > HTTP 통신 로그
     implementation 'com.squareup.okhttp3:logging-interceptor:3.11.0'    
     
     
## Retrofit2, API, Request, Response
   #### :point_right: Retrofit
        안드로이드 앱 개발 시 서버 통신에 사용되는 API를 Java interface로 변환해 개발할 때,
        API를 쉽게 호출할 수 있도록 해주는 라이브러리
   
   자세한 내용은 밑의 링크를 참고하세요.
   #### :[retrofit](https://square.github.io/retrofit/) 
           
   #### :point_right: Api는 'initMyApi' 인터페이스에 모두 정의
   #### :point_right: 서버통신 필요한 각 java 클래스들은 request와 response를 통해 연결
   
    1. initMyApi.java (일부분)
        // 버킷리스트 상세조회 (나의 버킷 확인 리스트에서 클릭시 상세보기페이지)
        @GET("/test/bucketlist")
        Call<JsonObject> getBKListDetailResponse(@Header("Authorization") String token,
                                                  @Query("bucketId") Integer bucketId);

        // 버킷리스트 세부계획 달성여부 판단
        @PUT("/test/bucketlist/detailplan/achieved")
        Call<JsonObject> getBKDetailAchievedResponse(@Header("Authorization") String token,
                                                      @Query("bucketId") Integer bucketId,
                                                      @Query("orderNumb") Integer orderNumb,
                                                      @Query("achieved") Integer achieved)

        // 버킷리스트 하트 누르기
        @POST("/test/bucketlist/heart")
        Call<JsonObject> getBKListHeartFullResponse(@Header("Authorization") String token,
                                                     @Query("bucketId") Integer bucketId);
                                                     
     2. RetrofitClient.java
              private RetrofitClient() {
                    //로그 보기 위한 interceptor
                    HttpLoggingInterceptor httpLoggingInterceptor = new HttpLoggingInterceptor();
                    httpLoggingInterceptor.setLevel(HttpLoggingInterceptor.Level.BODY);

                    OkHttpClient client = new OkHttpClient.Builder()
                              .addInterceptor(httpLoggingInterceptor) // update the token
                              .authenticator(new TokenAuthenticator())  // set the token in the header
                              .build();

                    //retrofit 설정
                    Retrofit retrofit = new Retrofit.Builder()
                            .baseUrl(baseUrl)
                            .addConverterFactory(GsonConverterFactory.create())
                            .client(client)   //로그 기능 추가
                            .build();

                    initMyApi = retrofit.create(initMyApi.class);
                    Log.d("TEST", "실행완료!");
                    Log.d("TEST", "Logging :  " + httpLoggingInterceptor);
               }
               
               
