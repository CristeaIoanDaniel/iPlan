import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter/foundation.dart';
import '../../../core/network/api_client.dart';
import '../models/user_model.dart';
class AuthService{
  final ApiClient _apiClient = ApiClient();
  final _storage = const FlutterSecureStorage();
  Future <bool> login (String email, String password ) async{
    try{
      final response = await _apiClient.post('/auth/login',{
        'email':email,
        'password':password,
      });
      if(response.statusCode==200){
        final data=jsonDecode(response.body);
        String token = data['token'];
        await _storage.write(key :'jwt_token',value:token);
        return true;
      }
      return false;
    }catch(e){
      debugPrint('Login error : $e');
      return false;
  }
  }
  Future <bool> register (String email, String password ) async{
    try{
      final response = await _apiClient.post ('/auth/register',{
        'email' :email,
        'password' : password,
      });
      return response.statusCode == 201 || response.statusCode == 200;
    }catch(e){
      debugPrint('Registration error : $e');
      return false;
    }
  }
  Future <void> logout() async{
    await _storage.delete(key:'jwt_token');
  }
  Future <bool> isLoggedIn() async{
    String? token = await _storage.read(key:'jwt_token');
    return token !=null;
  }
}
